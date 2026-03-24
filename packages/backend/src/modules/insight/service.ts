'use strict';

import type { CanonicalTrend } from '@trendmetrics/shared';
import { type AIProvider, getAIProvider } from '../../providers/ai.js';
import { createChildLogger } from '../../config/logger.js';

const logger = createChildLogger({ module: 'insight-service' });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TrendInsights {
  why_rising: string;
  who_cares: string;
  commercial_angle: string;
  brand_angle: string;
  ecommerce_angle: string;
  content_angle: string;
  risks: string;
  recommended_actions: string[];
  business_use_cases: string[];
}

const INSIGHT_SCHEMA = `{
  "why_rising": "string (2-4 sentences based on available evidence)",
  "who_cares": "string (target audience description)",
  "commercial_angle": "string (business opportunity)",
  "brand_angle": "string (branding opportunities)",
  "ecommerce_angle": "string (e-commerce opportunities)",
  "content_angle": "string (content creation opportunities)",
  "risks": "string (potential risks and uncertainties)",
  "recommended_actions": ["string array of exactly 5 actionable recommendations"],
  "business_use_cases": ["string array of 3-5 use cases"]
}`;

// ---------------------------------------------------------------------------
// InsightService
// ---------------------------------------------------------------------------

export class InsightService {
  private readonly aiProvider: AIProvider;
  private readonly batchSize: number;

  constructor(aiProvider?: AIProvider, batchSize: number = 10) {
    this.aiProvider = aiProvider ?? getAIProvider();
    this.batchSize = batchSize;
  }

  async generateInsights(trends: CanonicalTrend[]): Promise<CanonicalTrend[]> {
    logger.info('Starting insight generation', { inputCount: trends.length });

    const results: CanonicalTrend[] = [];

    for (let i = 0; i < trends.length; i += this.batchSize) {
      const batch = trends.slice(i, i + this.batchSize);
      const enriched = await Promise.allSettled(
        batch.map((trend) => this.enrichTrend(trend)),
      );

      for (let j = 0; j < batch.length; j++) {
        const result = enriched[j];
        if (result && result.status === 'fulfilled') {
          results.push(result.value);
        } else if (result && result.status === 'rejected') {
          const batchTrend = batch[j];
          logger.warn('Insight generation failed for trend', {
            title: batchTrend?.canonical_title ?? 'unknown',
            error: result.reason instanceof Error ? result.reason.message : String(result.reason),
          });
          results.push(this.applyFallbackInsights(batchTrend!));
        }
      }
    }

    logger.info('Insight generation completed', {
      inputCount: trends.length,
      outputCount: results.length,
    });

    return results;
  }

  // ---------------------------------------------------------------------------
  // Private: Enrich individual trend
  // ---------------------------------------------------------------------------

  private async enrichTrend(trend: CanonicalTrend): Promise<CanonicalTrend> {
    // Skip full insight generation for low-confidence trends
    if (trend.confidence_score < 30) {
      logger.debug('Skipping full insights for low-confidence trend', {
        title: trend.canonical_title,
        confidenceScore: trend.confidence_score,
      });
      return this.applyFallbackInsights(trend);
    }

    const context = this.buildContext(trend);
    const prompt = this.buildInsightPrompt(context);

    try {
      const insights = await this.aiProvider.generateStructuredContent<TrendInsights>(
        prompt,
        INSIGHT_SCHEMA,
        { temperature: 0.4, useGrounding: true },
      );

      return {
        ...trend,
        why_rising: insights.why_rising || trend.why_rising,
        who_cares: insights.who_cares || trend.who_cares,
        commercial_angle: insights.commercial_angle || trend.commercial_angle,
        brand_angle: insights.brand_angle || trend.brand_angle,
        ecommerce_angle: insights.ecommerce_angle || trend.ecommerce_angle,
        content_angle: insights.content_angle || trend.content_angle,
        risks: insights.risks || trend.risks,
        recommended_actions: Array.isArray(insights.recommended_actions)
          ? insights.recommended_actions.slice(0, 5)
          : trend.recommended_actions,
        business_use_cases: Array.isArray(insights.business_use_cases)
          ? insights.business_use_cases.slice(0, 5)
          : trend.business_use_cases,
      };
    } catch (err: unknown) {
      logger.error('Insight generation error', {
        title: trend.canonical_title,
        error: err instanceof Error ? err.message : String(err),
      });
      return this.applyFallbackInsights(trend);
    }
  }

  // ---------------------------------------------------------------------------
  // Private: Build context string from trend data
  // ---------------------------------------------------------------------------

  private buildContext(trend: CanonicalTrend): string {
    const parts = [
      `Trend: "${trend.canonical_title}"`,
      `Category: ${trend.category}`,
      `Country: ${trend.country}`,
      `Platforms: ${trend.source_platforms.join(', ')}`,
      `Verification: ${trend.verification_status} (evidence: ${trend.evidence_level})`,
      `Sources (${trend.sources.length}):`,
    ];

    for (const source of trend.sources.slice(0, 5)) {
      parts.push(`  - [${source.platform}] ${source.title} (${source.url})`);
      if (Object.keys(source.metrics).length > 0) {
        parts.push(`    Metrics: ${JSON.stringify(source.metrics)}`);
      }
    }

    if (trend.summary) {
      parts.push(`Current summary: ${trend.summary}`);
    }

    parts.push(
      `Scores: momentum=${trend.momentum_score}, confidence=${trend.confidence_score}, commercial=${trend.commercial_relevance_score}, freshness=${trend.freshness_score}`,
    );

    // Include score explanations so the AI knows why scores are what they are
    if (Object.keys(trend.score_explanations).length > 0) {
      parts.push(`Score rationale: ${JSON.stringify(trend.score_explanations)}`);
    }

    return parts.join('\n');
  }

  // ---------------------------------------------------------------------------
  // Private: Build insight prompt
  // ---------------------------------------------------------------------------

  private buildInsightPrompt(context: string): string {
    return `You are a senior market intelligence analyst. Based on the following verified trend data, generate business insights.

IMPORTANT RULES:
- Base all analysis on the provided data and evidence
- If data is limited, say so explicitly — do not fabricate metrics or statistics
- Clearly distinguish between what is supported by evidence vs. what is inferred
- Recommended actions must be specific and actionable (exactly 5 items)
- Keep each field concise but substantive (2-4 sentences max per field)
- Reference the actual source data and platforms where the trend was found

TREND DATA:
${context}

Generate insights in the exact JSON format specified. Every insight must trace back to the provided data.`;
  }

  // ---------------------------------------------------------------------------
  // Private: Fallback insights for low-confidence or failed trends
  // ---------------------------------------------------------------------------

  private applyFallbackInsights(trend: CanonicalTrend): CanonicalTrend {
    const platformList = trend.source_platforms.join(', ') || 'unknown platforms';
    const sourceCount = trend.sources.length;

    return {
      ...trend,
      why_rising: trend.why_rising ||
        `This trend was detected on ${platformList} based on ${sourceCount} source(s). Insufficient data for detailed causal analysis.`,
      who_cares: trend.who_cares ||
        `Audiences following ${trend.category || 'this topic'} on ${platformList}.`,
      commercial_angle: trend.commercial_angle ||
        'Limited data available. Monitor for commercial signals as more sources emerge.',
      brand_angle: trend.brand_angle ||
        'Insufficient data for brand-specific recommendations.',
      ecommerce_angle: trend.ecommerce_angle ||
        'No strong e-commerce signals detected yet.',
      content_angle: trend.content_angle ||
        `Content creators in the ${trend.category || 'related'} space may find this relevant.`,
      risks: trend.risks ||
        `Low confidence level (${trend.confidence_score}/100). Limited sources available for verification.`,
      recommended_actions: trend.recommended_actions.length > 0
        ? trend.recommended_actions
        : [
            'Monitor trend development over the next 24-48 hours',
            'Cross-reference with your own analytics data',
            'Set up alerts for this topic on relevant platforms',
            'Assess relevance to your specific market segment',
            'Wait for more sources before making strategic decisions',
          ],
      business_use_cases: trend.business_use_cases.length > 0
        ? trend.business_use_cases
        : ['Market monitoring', 'Competitive intelligence'],
    };
  }
}
