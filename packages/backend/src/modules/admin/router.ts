import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { lt, count, sql } from "drizzle-orm";
import type { ApiResponse } from "@trendmetrics/shared";
import { PLATFORM_CONFIGS } from "@trendmetrics/shared";
import { db } from "../../db/index.js";
import * as schema from "../../db/schema.js";
import { logger } from "../../config/logger.js";

const router = Router();

// ---------------------------------------------------------------------------
// Admin guard -- requires x-user-id in ADMIN_UIDS env var (comma-separated)
// ---------------------------------------------------------------------------

function requireAdmin(req: Request, res: Response): string | null {
  const userId = req.headers["x-user-id"] as string | undefined;
  if (!userId) {
    const body: ApiResponse<null> = {
      success: false,
      error: { code: "UNAUTHORIZED", message: "Missing authentication" },
    };
    res.status(401).json(body);
    return null;
  }

  const adminUids = (process.env["ADMIN_UIDS"] ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (!adminUids.includes(userId)) {
    const body: ApiResponse<null> = {
      success: false,
      error: { code: "FORBIDDEN", message: "Admin access required" },
    };
    res.status(403).json(body);
    return null;
  }

  return userId;
}

// ---------------------------------------------------------------------------
// GET /api/admin/connectors
// List all connectors with capabilities and stats
// ---------------------------------------------------------------------------

router.get(
  "/connectors",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const adminId = requireAdmin(req, res);
      if (!adminId) return;

      const configs = PLATFORM_CONFIGS as unknown as Record<string, { id: string; name: string; group: string; capabilities: Record<string, unknown> }>;
      const connectors = Object.values(configs).map((cfg) => ({
        id: cfg.id,
        name: cfg.name,
        group: cfg.group,
        capabilities: cfg.capabilities,
      }));

      // Gather latest run stats per connector
      const runs = await db
        .select({
          connectorId: schema.connectorRuns.connectorId,
          totalRuns: count(schema.connectorRuns.id),
        })
        .from(schema.connectorRuns)
        .groupBy(schema.connectorRuns.connectorId);

      const runMap = new Map(runs.map((r) => [r.connectorId, r.totalRuns]));

      const enriched = connectors.map((c) => ({
        ...c,
        total_runs: runMap.get(c.id) ?? 0,
      }));

      const body: ApiResponse<typeof enriched> = { success: true, data: enriched };
      res.json(body);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /api/admin/cache/flush
// Flush expired cache entries
// ---------------------------------------------------------------------------

router.post(
  "/cache/flush",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const adminId = requireAdmin(req, res);
      if (!adminId) return;

      const result = await db
        .delete(schema.cacheEntries)
        .where(lt(schema.cacheEntries.expiresAt, new Date()))
        .returning({ key: schema.cacheEntries.key });

      const flushed = result.length;

      logger.info("Cache flush completed", { adminId, flushed });

      await db.insert(schema.auditLogs).values({
        userId: adminId,
        action: "cache_flush",
        resourceType: "cache",
        resourceId: "expired",
        details: { flushed },
      });

      const body: ApiResponse<{ flushed: number }> = {
        success: true,
        data: { flushed },
      };
      res.json(body);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /api/admin/metrics
// Basic usage metrics
// ---------------------------------------------------------------------------

router.get(
  "/metrics",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const adminId = requireAdmin(req, res);
      if (!adminId) return;

      const [userCount] = await db
        .select({ value: count(schema.users.id) })
        .from(schema.users);

      const [queryCount] = await db
        .select({ value: count(schema.trendQueries.id) })
        .from(schema.trendQueries);

      const [trendCount] = await db
        .select({ value: count(schema.canonicalTrends.id) })
        .from(schema.canonicalTrends);

      const [reportCount] = await db
        .select({ value: count(schema.trendReports.id) })
        .from(schema.trendReports);

      const [cacheCount] = await db
        .select({ value: count(schema.cacheEntries.key) })
        .from(schema.cacheEntries);

      const [txnSum] = await db
        .select({
          value: sql<string>`COALESCE(SUM(ABS(${schema.creditTransactions.amount})), 0)`,
        })
        .from(schema.creditTransactions);

      const metrics = {
        total_users: userCount?.value ?? 0,
        total_queries: queryCount?.value ?? 0,
        total_trends: trendCount?.value ?? 0,
        total_reports: reportCount?.value ?? 0,
        cache_entries: cacheCount?.value ?? 0,
        total_credit_volume: Number(txnSum?.value ?? 0),
      };

      const body: ApiResponse<typeof metrics> = { success: true, data: metrics };
      res.json(body);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
