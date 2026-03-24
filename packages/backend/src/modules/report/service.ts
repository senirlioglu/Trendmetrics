'use strict';

import { eq, desc, and } from 'drizzle-orm';
import type { DeepAnalysisReport, DailyReport, PlatformGroupId } from '@trendmetrics/shared';
import { db } from '../../db/index.js';
import { canonicalTrends, trendSources, trendReports, dailyReports } from '../../db/schema.js';
import { CreditService } from '../credit/service.js';
import { type AIProvider, getAIProvider } from '../../providers/ai.js';
import { config } from '../../config/index.js';
import { createChildLogger } from '../../config/logger.js';
import { AppError } from '../../middleware/errorHandler.js';
import { v4 as uuidv4 } from 'uuid';

const logger = createChildLogger({ module: 'report-service' });

// ---------------------------------------------------------------------------
// ReportService
// ---------------------------------------------------------------------------

export class ReportService {
  private readonly creditService: CreditService;
  private readonly aiProvider: AIProvider;

  constructor(creditService: CreditService, aiProvider?: AIProvider) {
    this.creditService = creditService;
    this.aiProvider = aiProvider ?? getAIProvider();
  }

  // ---------------------------------------------------------------------------
  // Deep Analysis Report
  // ---------------------------------------------------------------------------

  async generateDeepAnalysis(
    trendId: string,
    userId: string,
    idempotencyKey?: string,
  ): Promise<DeepAnalysisReport> {
    // 1. Load canonical trend with all sources and scores
    const trends = await db
      .select()
      .from(canonicalTrends)
      .where(eq(canonicalTrends.id, trendId))
      .limit(1);

    if (trends.length === 0) {
      throw new AppError(404, 'TREND_NOT_FOUND', 'Trend not found');
    }
    const trend = trends[0]!;

    const sources = await db
      .select()
      .from(trendSources)
      .where(eq(trendSources.trendId, trendId));

    // 2. Deduct credits
    const idemKey = idempotencyKey ?? `deep_analysis_${trendId}_${userId}_${Date.now()}`;
    let transaction;
    try {
      transaction = await this.creditService.deduct(
        userId,
        config.credits.deepAnalysisCost,
        'deep_analysis',
        `Deep Analysis: ${trend.canonicalTitle}`,
        idemKey,
      );
    } catch (err: unknown) {
      // Re-throw insufficient balance or other errors
      throw err;
    }

    // 3. Generate report via AI
    try {
      const prompt = this.buildDeepAnalysisPrompt(trend, sources);
      const content = await this.aiProvider.generateContent(prompt, {
        temperature: 0.5,
        useGrounding: true,
      });

      // 4. Extract data layers
      const dataLayers = this.extractDataLayers(content);

      const report: DeepAnalysisReport = {
        id: uuidv4(),
        trend_id: trendId,
        user_id: userId,
        content_markdown: content,
        data_layers: dataLayers,
        generated_at: new Date(),
        cost: config.credits.deepAnalysisCost,
        model_used: config.gemini.defaultModel,
      };

      // 5. Save to DB
      await db.insert(trendReports).values({
        id: report.id,
        trendId,
        userId,
        reportType: 'deep_analysis',
        contentMarkdown: content,
        dataLayers,
        modelUsed: report.model_used,
        cost: String(report.cost),
        createdAt: report.generated_at,
      });

      logger.info('Deep analysis generated', {
        trendId,
        userId,
        reportId: report.id,
        title: trend.canonicalTitle,
      });

      return report;
    } catch (err: unknown) {
      // 6. If AI call fails, refund credits
      logger.error('Deep analysis failed, refunding credits', {
        trendId,
        userId,
        error: err instanceof Error ? err.message : String(err),
      });
      await this.creditService.refund(transaction.id).catch((refundErr: unknown) => {
        logger.error('Refund also failed', {
          originalTxId: transaction.id,
          error: refundErr instanceof Error ? refundErr.message : String(refundErr),
        });
      });
      throw new AppError(
        500,
        'REPORT_GENERATION_FAILED',
        'Failed to generate report. Credits have been refunded.',
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Daily Report
  // ---------------------------------------------------------------------------

  async generateDailyReport(
    userId: string,
    platformGroup: PlatformGroupId,
    category: string,
    country: string,
    idempotencyKey?: string,
  ): Promise<DailyReport> {
    // 1. Load recent canonical trends for the given filters
    const recentTrends = await db
      .select()
      .from(canonicalTrends)
      .where(eq(canonicalTrends.category, category))
      .orderBy(desc(canonicalTrends.momentumScore))
      .limit(20);

    if (recentTrends.length === 0) {
      throw new AppError(
        400,
        'NO_TRENDS',
        'No trends available for this filter combination. Run a discovery first.',
      );
    }

    // 2. Deduct credits
    const idemKey = idempotencyKey ?? `daily_report_${platformGroup}_${category}_${country}_${userId}_${Date.now()}`;
    let transaction;
    try {
      transaction = await this.creditService.deduct(
        userId,
        config.credits.dailyReportCost,
        'daily_report',
        `Daily Report: ${platformGroup} / ${category} / ${country}`,
        idemKey,
      );
    } catch (err: unknown) {
      throw err;
    }

    // 3. Generate report via AI
    try {
      const prompt = this.buildDailyReportPrompt(platformGroup, category, country, recentTrends);
      const content = await this.aiProvider.generateContent(prompt, {
        temperature: 0.5,
        useGrounding: true,
      });

      const report: DailyReport = {
        id: uuidv4(),
        user_id: userId,
        platform_group: platformGroup,
        category,
        country,
        content_markdown: content,
        trend_count: recentTrends.length,
        generated_at: new Date(),
      };

      // 4. Save to DB
      await db.insert(dailyReports).values({
        id: report.id,
        userId,
        platformGroup,
        category,
        country,
        contentMarkdown: content,
        trendCount: recentTrends.length,
        createdAt: report.generated_at,
      });

      logger.info('Daily report generated', {
        userId,
        platformGroup,
        category,
        country,
        reportId: report.id,
        trendCount: recentTrends.length,
      });

      return report;
    } catch (err: unknown) {
      // 5. If fails, refund credits
      logger.error('Daily report failed, refunding credits', {
        userId,
        error: err instanceof Error ? err.message : String(err),
      });
      await this.creditService.refund(transaction.id).catch((refundErr: unknown) => {
        logger.error('Refund also failed', {
          originalTxId: transaction.id,
          error: refundErr instanceof Error ? refundErr.message : String(refundErr),
        });
      });
      throw new AppError(
        500,
        'REPORT_GENERATION_FAILED',
        'Failed to generate daily report. Credits have been refunded.',
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Report History
  // ---------------------------------------------------------------------------

  async getReportHistory(
    userId: string,
    type: 'deep_analysis' | 'daily',
    limit: number = 10,
    offset: number = 0,
  ): Promise<unknown[]> {
    if (type === 'deep_analysis') {
      return db
        .select()
        .from(trendReports)
        .where(
          and(
            eq(trendReports.userId, userId),
            eq(trendReports.reportType, 'deep_analysis'),
          ),
        )
        .orderBy(desc(trendReports.createdAt))
        .limit(limit)
        .offset(offset);
    }

    return db
      .select()
      .from(dailyReports)
      .where(eq(dailyReports.userId, userId))
      .orderBy(desc(dailyReports.createdAt))
      .limit(limit)
      .offset(offset);
  }

  // ---------------------------------------------------------------------------
  // Private: Prompt Builders
  // ---------------------------------------------------------------------------

  private buildDeepAnalysisPrompt(
    trend: typeof canonicalTrends.$inferSelect,
    sources: (typeof trendSources.$inferSelect)[],
  ): string {
    const sourceDetails = sources
      .map(
        (s) =>
          `- [${s.platform}] "${s.title ?? ''}" — ${s.url ?? 'No URL'}\n  Metrics: ${JSON.stringify(s.metrics ?? {})}\n  Verified: ${s.verifiedAt ? 'Yes' : 'No'}, Accessible: ${s.isAccessible ? 'Yes' : 'Unknown'}`,
      )
      .join('\n');

    return `You are a senior market intelligence analyst preparing a professional Deep Intelligence Report.

TREND DATA:
Title: "${trend.canonicalTitle}"
Category: ${trend.category ?? 'N/A'}
Country: ${trend.country ?? 'N/A'}
Platforms: ${(trend.sourcePlatforms ?? []).join(', ')}
Verification Status: ${trend.verificationStatus}
Evidence Level: ${trend.evidenceLevel}
Confidence Score: ${trend.confidenceScore}/100
Momentum Score: ${trend.momentumScore}/100

SOURCES (${sources.length}):
${sourceDetails}

Current Summary: ${trend.summary ?? 'N/A'}
Score Explanations: ${JSON.stringify(trend.scoreExplanations ?? {})}

INSTRUCTIONS:
Write a comprehensive Markdown report (500+ words) with these MANDATORY sections:

# Deep Intelligence Report: ${trend.canonicalTitle}

## Executive Summary
(2-3 paragraph overview of the trend and its significance)

## Why This Trend Is Growing
(Analysis of driving factors — cultural, algorithmic, seasonal, etc.)

## Platform Breakdown
(How this trend manifests differently on each platform where it was found)

## Audience & Intent Signals
(Who is engaging, demographics, psychographics, search intent)

## Commercial Opportunity
(Specific business opportunities for brands, e-commerce, content creators)

## Risks & Uncertainty
(What could go wrong, sustainability, regulatory, ethical concerns)

## Recommended Actions
(5 numbered, specific, actionable recommendations)

## Source Notes
(Acknowledge data quality)

CRITICAL DATA INTEGRITY RULES:
- For data you can verify from the sources above, mark as [VERIFIED DATA]
- For reasonable inferences from the data, mark as [INFERRED]
- For areas where data is insufficient, mark as [WEAK SIGNAL]
- NEVER invent specific numbers, statistics, or metrics not found in the source data
- If engagement numbers aren't available, say "engagement data not available" rather than guessing
- Be explicit about what you know vs. what you're estimating`;
  }

  private buildDailyReportPrompt(
    platformGroup: string,
    category: string,
    country: string,
    trends: (typeof canonicalTrends.$inferSelect)[],
  ): string {
    const trendSummaries = trends
      .map(
        (t, i) =>
          `${i + 1}. "${t.canonicalTitle}" — Momentum: ${t.momentumScore}/100, Confidence: ${t.confidenceScore}/100, Platforms: ${(t.sourcePlatforms ?? []).join(', ')}`,
      )
      .join('\n');

    return `You are a senior market strategist preparing a Daily Market Intelligence Report.

REPORT CONTEXT:
Platform Focus: ${platformGroup}
Category: ${category}
Region: ${country}
Date: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
Total Trends Analyzed: ${trends.length}

CURRENT TREND DATA:
${trendSummaries}

Write a comprehensive Markdown report with these MANDATORY sections:

# Daily Market Intelligence Report

## Market Overview
(Overall market sentiment and key movements)

## Macro Trend Analysis
(3-5 macro patterns emerging from the data)

## Emerging Clusters
(Groups of related trends that form larger narratives)

## Platform-Specific Insights
(Breakdown by platform with specific observations)

## Commercial Opportunities
(Actionable business opportunities identified today)

## Strategic Risks
(Declining trends, market risks, controversies)

## Actionable Plays
### Short-term (This Week)
### Medium-term (This Month)
### Long-term (This Quarter)

## Tomorrow's Outlook
(Predicted movements for next 24-48 hours)

RULES:
- Be specific — generic advice is useless
- Reference specific trends from the data by name
- Distinguish [VERIFIED DATA] from [INFERRED] insights
- If data is thin for an area, acknowledge it honestly`;
  }

  // ---------------------------------------------------------------------------
  // Private: Extract data layers from report content
  // ---------------------------------------------------------------------------

  private extractDataLayers(content: string): {
    verified_data: string[];
    inferred_insights: string[];
    weak_signals: string[];
  } {
    const extract = (pattern: RegExp): string[] => {
      const matches: string[] = [];
      let match;
      while ((match = pattern.exec(content)) !== null) {
        if (match[1]) {
          matches.push(match[1].trim());
        }
      }
      return matches;
    };

    return {
      verified_data: extract(/\[VERIFIED DATA\][:\s]*([^\n[]+)/g),
      inferred_insights: extract(/\[INFERRED\][:\s]*([^\n[]+)/g),
      weak_signals: extract(/\[WEAK SIGNAL\][:\s]*([^\n[]+)/g),
    };
  }
}
