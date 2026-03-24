import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { eq, desc, and } from "drizzle-orm";
import type { ApiResponse, DeepAnalysisReport, DailyReport } from "@trendmetrics/shared";
import { db } from "../../db/index.js";
import * as schema from "../../db/schema.js";
import {
  dailyReportRequestSchema,
  reportHistoryQuerySchema,
} from "../../utils/validation.js";
import { generateId } from "../../utils/helpers.js";
import { config } from "../../config/index.js";
import { logger } from "../../config/logger.js";

const router = Router();

// ---------------------------------------------------------------------------
// Auth guard
// ---------------------------------------------------------------------------

function requireUser(req: Request, res: Response): string | null {
  const userId = req.headers["x-user-id"] as string | undefined;
  if (!userId) {
    const body: ApiResponse<null> = {
      success: false,
      error: { code: "UNAUTHORIZED", message: "Missing authentication" },
    };
    res.status(401).json(body);
    return null;
  }
  return userId;
}

// ---------------------------------------------------------------------------
// Credit deduction helper (shared logic, same as in discovery router)
// ---------------------------------------------------------------------------

async function deductCredits(
  userId: string,
  cost: number,
  type: "deep_analysis" | "daily_report",
  description: string,
): Promise<{ ok: boolean; newBalance: number }> {
  const [balanceRow] = await db
    .select()
    .from(schema.userBalances)
    .where(eq(schema.userBalances.userId, userId))
    .limit(1);

  const currentBalance = balanceRow ? Number(balanceRow.balance) : 0;

  if (currentBalance < cost) {
    return { ok: false, newBalance: currentBalance };
  }

  const newBalance = currentBalance - cost;

  await db
    .update(schema.userBalances)
    .set({ balance: String(newBalance), updatedAt: new Date() })
    .where(eq(schema.userBalances.userId, userId));

  await db.insert(schema.creditTransactions).values({
    userId,
    type,
    amount: String(-cost),
    balanceAfter: String(newBalance),
    description,
    status: "completed",
  });

  return { ok: true, newBalance };
}

// ---------------------------------------------------------------------------
// POST /api/trends/:id/deep-analysis
// Idempotency key required in header (X-Idempotency-Key)
// ---------------------------------------------------------------------------

router.post(
  "/:id/deep-analysis",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = requireUser(req, res);
      if (!userId) return;

      const trendId = req.params["id"] as string;

      // Require idempotency key
      const idempotencyKey = req.headers["x-idempotency-key"] as string | undefined;
      if (!idempotencyKey) {
        const body: ApiResponse<null> = {
          success: false,
          error: { code: "MISSING_IDEMPOTENCY_KEY", message: "X-Idempotency-Key header is required" },
        };
        res.status(400).json(body);
        return;
      }

      // Check idempotency -- if a report already exists with this key, return it
      const [existing] = await db
        .select()
        .from(schema.creditTransactions)
        .where(eq(schema.creditTransactions.idempotencyKey, idempotencyKey))
        .limit(1);

      if (existing) {
        // Find the corresponding report
        const [report] = await db
          .select()
          .from(schema.trendReports)
          .where(
            and(
              eq(schema.trendReports.trendId, trendId),
              eq(schema.trendReports.userId, userId),
            ),
          )
          .orderBy(desc(schema.trendReports.createdAt))
          .limit(1);

        if (report) {
          const result: DeepAnalysisReport = {
            id: report.id,
            trend_id: report.trendId,
            user_id: report.userId,
            content_markdown: report.contentMarkdown ?? "",
            data_layers: (report.dataLayers ?? {
              verified_data: [],
              inferred_insights: [],
              weak_signals: [],
            }) as DeepAnalysisReport["data_layers"],
            generated_at: report.createdAt,
            cost: Number(report.cost ?? 0),
            model_used: report.modelUsed ?? "",
          };

          const body: ApiResponse<DeepAnalysisReport> = { success: true, data: result };
          res.json(body);
          return;
        }
      }

      // Verify trend exists
      const [trend] = await db
        .select()
        .from(schema.canonicalTrends)
        .where(eq(schema.canonicalTrends.id, trendId))
        .limit(1);

      if (!trend) {
        const body: ApiResponse<null> = {
          success: false,
          error: { code: "NOT_FOUND", message: "Trend not found" },
        };
        res.status(404).json(body);
        return;
      }

      // Deduct credits
      const cost = config.credits.deepAnalysisCost;
      const { ok } = await deductCredits(userId, cost, "deep_analysis", `Deep analysis: ${trend.canonicalTitle}`);
      if (!ok) {
        const body: ApiResponse<null> = {
          success: false,
          error: { code: "INSUFFICIENT_CREDITS", message: "Not enough credits for deep analysis" },
        };
        res.status(402).json(body);
        return;
      }

      // Generate report (placeholder -- a real implementation would call Gemini)
      const reportId = generateId();
      const modelUsed = config.gemini.defaultModel;

      const contentMarkdown = [
        `# Deep Analysis: ${trend.canonicalTitle}`,
        "",
        `## Summary`,
        trend.summary ?? "No summary available.",
        "",
        `## Why It's Rising`,
        trend.whyRising ?? "Analysis pending.",
        "",
        `## Who Cares`,
        trend.whoCares ?? "Analysis pending.",
        "",
        `## Commercial Angle`,
        trend.commercialAngle ?? "Analysis pending.",
        "",
        `## Risks`,
        trend.risks ?? "None identified yet.",
        "",
        `*Generated at ${new Date().toISOString()} using ${modelUsed}*`,
      ].join("\n");

      const dataLayers: DeepAnalysisReport["data_layers"] = {
        verified_data: [`Momentum score: ${trend.momentumScore ?? "N/A"}`],
        inferred_insights: [trend.whyRising ?? "Pending"],
        weak_signals: [trend.risks ?? "None"],
      };

      await db.insert(schema.trendReports).values({
        id: reportId,
        trendId,
        userId,
        reportType: "deep_analysis",
        contentMarkdown,
        dataLayers,
        modelUsed,
        cost: String(cost),
      });

      // Record idempotency on the credit transaction
      await db
        .update(schema.creditTransactions)
        .set({ idempotencyKey })
        .where(
          and(
            eq(schema.creditTransactions.userId, userId),
            eq(schema.creditTransactions.type, "deep_analysis"),
          ),
        );

      logger.info("Deep analysis report generated", { reportId, trendId, userId });

      // Audit
      await db.insert(schema.auditLogs).values({
        userId,
        action: "deep_analysis",
        resourceType: "trend_report",
        resourceId: reportId,
        details: { trendId, cost },
        ipAddress: req.ip ?? null,
      });

      const result: DeepAnalysisReport = {
        id: reportId,
        trend_id: trendId,
        user_id: userId,
        content_markdown: contentMarkdown,
        data_layers: dataLayers,
        generated_at: new Date(),
        cost,
        model_used: modelUsed,
      };

      const body: ApiResponse<DeepAnalysisReport> = { success: true, data: result };
      res.status(201).json(body);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /api/reports/daily
// Body: { platform_group, category, country }
// ---------------------------------------------------------------------------

router.post(
  "/daily",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = requireUser(req, res);
      if (!userId) return;

      const parsed = dailyReportRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        const body: ApiResponse<null> = {
          success: false,
          error: { code: "VALIDATION_ERROR", message: parsed.error.message },
        };
        res.status(400).json(body);
        return;
      }

      const { platform_group, category, country } = parsed.data;

      // Deduct credits
      const cost = config.credits.dailyReportCost;
      const { ok } = await deductCredits(userId, cost, "daily_report", `Daily report: ${platform_group} / ${category}`);
      if (!ok) {
        const body: ApiResponse<null> = {
          success: false,
          error: { code: "INSUFFICIENT_CREDITS", message: "Not enough credits for daily report" },
        };
        res.status(402).json(body);
        return;
      }

      // Generate placeholder daily report
      const reportId = generateId();
      const contentMarkdown = [
        `# Daily Market Report`,
        "",
        `**Platform Group:** ${platform_group}`,
        `**Category:** ${category}`,
        `**Country:** ${country}`,
        `**Date:** ${new Date().toISOString().slice(0, 10)}`,
        "",
        `## Top Trends`,
        "",
        "No trends fetched yet -- pipeline integration pending.",
        "",
        `*Generated at ${new Date().toISOString()}*`,
      ].join("\n");

      await db.insert(schema.dailyReports).values({
        id: reportId,
        userId,
        platformGroup: platform_group,
        category,
        country,
        contentMarkdown,
        trendCount: 0,
      });

      logger.info("Daily report generated", { reportId, userId, platform_group, category, country });

      // Audit
      await db.insert(schema.auditLogs).values({
        userId,
        action: "daily_report",
        resourceType: "daily_report",
        resourceId: reportId,
        details: { platform_group, category, country, cost },
        ipAddress: req.ip ?? null,
      });

      const result: DailyReport = {
        id: reportId,
        user_id: userId,
        platform_group,
        category,
        country,
        content_markdown: contentMarkdown,
        trend_count: 0,
        generated_at: new Date(),
      };

      const body: ApiResponse<DailyReport> = { success: true, data: result };
      res.status(201).json(body);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /api/reports/history
// Query: type, limit, offset
// ---------------------------------------------------------------------------

router.get(
  "/history",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = requireUser(req, res);
      if (!userId) return;

      const parsed = reportHistoryQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        const body: ApiResponse<null> = {
          success: false,
          error: { code: "VALIDATION_ERROR", message: parsed.error.message },
        };
        res.status(400).json(body);
        return;
      }

      const { type, limit, offset } = parsed.data;

      // Build conditions
      const conditions = [eq(schema.trendReports.userId, userId)];
      if (type) {
        conditions.push(eq(schema.trendReports.reportType, type));
      }

      const rows = await db
        .select()
        .from(schema.trendReports)
        .where(and(...conditions))
        .orderBy(desc(schema.trendReports.createdAt))
        .limit(limit)
        .offset(offset);

      const reports = rows.map((r) => ({
        id: r.id,
        trend_id: r.trendId,
        user_id: r.userId,
        report_type: r.reportType,
        content_markdown: r.contentMarkdown ?? "",
        data_layers: r.dataLayers ?? null,
        model_used: r.modelUsed ?? "",
        cost: Number(r.cost ?? 0),
        created_at: r.createdAt,
      }));

      const body: ApiResponse<typeof reports> = { success: true, data: reports };
      res.json(body);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
