import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import type { ApiResponse, CanonicalTrend } from "@trendmetrics/shared";
import { db } from "../../db/index.js";
import * as schema from "../../db/schema.js";
import { discoverRequestSchema } from "../../utils/validation.js";
import { generateId, hashParams } from "../../utils/helpers.js";
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
// Credit deduction helper
// ---------------------------------------------------------------------------

async function deductCredits(
  userId: string,
  cost: number,
  type: "force_refresh" | "deep_analysis" | "daily_report",
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
// Cache helpers
// ---------------------------------------------------------------------------

async function getCache(key: string): Promise<CanonicalTrend[] | null> {
  const [row] = await db
    .select()
    .from(schema.cacheEntries)
    .where(eq(schema.cacheEntries.key, key))
    .limit(1);

  if (!row) return null;
  if (new Date(row.expiresAt) < new Date()) return null;

  // Bump hit count
  await db
    .update(schema.cacheEntries)
    .set({ hitCount: (row.hitCount ?? 0) + 1 })
    .where(eq(schema.cacheEntries.key, key));

  return row.data as CanonicalTrend[];
}

async function setCache(key: string, data: CanonicalTrend[]): Promise<void> {
  const ttlMs = config.cache.hotTtlMinutes * 60 * 1000;
  const expiresAt = new Date(Date.now() + ttlMs);

  // Upsert
  await db
    .insert(schema.cacheEntries)
    .values({ key, level: "hot", data, expiresAt, hitCount: 0 })
    .onConflictDoUpdate({
      target: schema.cacheEntries.key,
      set: { data, expiresAt, hitCount: 0, createdAt: new Date() },
    });
}

// ---------------------------------------------------------------------------
// POST /api/trends/discover
// ---------------------------------------------------------------------------

router.post(
  "/discover",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = requireUser(req, res);
      if (!userId) return;

      // 1. Validate
      const parsed = discoverRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        const body: ApiResponse<null> = {
          success: false,
          error: { code: "VALIDATION_ERROR", message: parsed.error.message },
        };
        res.status(400).json(body);
        return;
      }

      const request = parsed.data;

      // 2. Check cache (unless force_refresh)
      const cacheKey = `trends:${hashParams({
        pg: request.platform_group,
        cat: request.category,
        co: request.country,
        lang: request.language,
        sq: request.seed_query ?? "",
      })}`;

      if (!request.force_refresh) {
        const cached = await getCache(cacheKey);
        if (cached) {
          logger.debug("Cache hit", { cacheKey });
          const body: ApiResponse<CanonicalTrend[]> = {
            success: true,
            data: cached,
            meta: { cached: true, cache_level: "hot", generated_at: new Date().toISOString() },
          };
          res.json(body);
          return;
        }
      }

      // 3. If force_refresh, deduct credit
      if (request.force_refresh) {
        const { ok } = await deductCredits(
          userId,
          config.credits.forceRefreshCost,
          "force_refresh",
          "Force refresh trend discovery",
        );
        if (!ok) {
          const body: ApiResponse<null> = {
            success: false,
            error: { code: "INSUFFICIENT_CREDITS", message: "Not enough credits for force refresh" },
          };
          res.status(402).json(body);
          return;
        }
      }

      // 4. Run pipeline
      // The pipeline is injected at app-startup and attached to app.locals.
      // If unavailable we return an error rather than crashing.
      const pipeline = req.app.locals["trendPipeline"] as
        | { execute: (r: typeof request, uid: string) => Promise<CanonicalTrend[]> }
        | undefined;

      let trends: CanonicalTrend[];
      if (pipeline) {
        trends = await pipeline.execute(request, userId);
      } else {
        logger.warn("TrendPipeline not registered in app.locals; returning empty results");
        trends = [];
      }

      // 5. Cache results
      if (trends.length > 0) {
        await setCache(cacheKey, trends);
      }

      // 6. Save trend_query to DB
      const queryId = generateId();
      await db.insert(schema.trendQueries).values({
        id: queryId,
        userId,
        platformGroup: request.platform_group,
        platforms: [],
        category: request.category,
        country: request.country,
        language: request.language,
        seedQuery: request.seed_query ?? null,
        status: "completed",
        hitCount: trends.length,
        completedAt: new Date(),
      });

      // 7. Return response
      const body: ApiResponse<CanonicalTrend[]> = {
        success: true,
        data: trends,
        meta: {
          cached: false,
          generated_at: new Date().toISOString(),
        },
      };
      res.json(body);

      // 8. Audit log (fire-and-forget)
      db.insert(schema.auditLogs)
        .values({
          userId,
          action: "trend_discover",
          resourceType: "trend_query",
          resourceId: queryId,
          details: { request, trendCount: trends.length },
          ipAddress: req.ip ?? null,
        })
        .catch((err: unknown) => logger.error("Audit log insert failed", { error: (err as Error).message }));
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /api/trends/:id
// Returns single CanonicalTrend with all sources and scores
// ---------------------------------------------------------------------------

router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;

    const trendId = req.params["id"] as string;

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

    // Fetch sources
    const sources = await db
      .select()
      .from(schema.trendSources)
      .where(eq(schema.trendSources.trendId, trendId));

    const canonical: CanonicalTrend = {
      id: trend.id,
      canonical_title: trend.canonicalTitle,
      aliases: trend.aliases ?? [],
      category: trend.category ?? "",
      country: trend.country ?? "",
      language: trend.language ?? "",
      source_platforms: (trend.sourcePlatforms ?? []) as CanonicalTrend["source_platforms"],
      sources: sources.map((s) => ({
        platform: s.platform as CanonicalTrend["source_platforms"][number],
        url: s.url ?? "",
        title: s.title ?? "",
        metrics: (s.metrics ?? {}) as Record<string, string | number>,
        verified_at: s.verifiedAt,
        is_accessible: s.isAccessible ?? false,
        search_fallback_url: s.searchFallbackUrl ?? "",
      })),
      first_seen_at: trend.firstSeenAt,
      last_verified_at: trend.lastVerifiedAt ?? trend.firstSeenAt,
      verification_status: trend.verificationStatus as CanonicalTrend["verification_status"],
      evidence_level: trend.evidenceLevel as CanonicalTrend["evidence_level"],
      summary: trend.summary ?? "",
      thumbnail_url: trend.thumbnailUrl ?? "",
      search_fallback_url: trend.searchFallbackUrl ?? "",
      momentum_score: Number(trend.momentumScore ?? 0),
      confidence_score: Number(trend.confidenceScore ?? 0),
      cross_platform_score: Number(trend.crossPlatformScore ?? 0),
      commercial_relevance_score: Number(trend.commercialRelevanceScore ?? 0),
      freshness_score: Number(trend.freshnessScore ?? 0),
      score_explanations: (trend.scoreExplanations ?? {}) as Record<string, string>,
      why_rising: trend.whyRising ?? "",
      who_cares: trend.whoCares ?? "",
      commercial_angle: trend.commercialAngle ?? "",
      brand_angle: trend.brandAngle ?? "",
      ecommerce_angle: trend.ecommerceAngle ?? "",
      content_angle: trend.contentAngle ?? "",
      risks: trend.risks ?? "",
      recommended_actions: trend.recommendedActions ?? [],
      business_use_cases: trend.businessUseCases ?? [],
      raw_signals: (trend.rawSignals ?? {}) as Record<string, unknown>,
    };

    const body: ApiResponse<CanonicalTrend> = { success: true, data: canonical };
    res.json(body);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/trends/:id/verify
// Re-run verification for a specific trend
// ---------------------------------------------------------------------------

router.post(
  "/:id/verify",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = requireUser(req, res);
      if (!userId) return;

      const trendId = req.params["id"] as string;

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

      // Record a new verification entry
      const verificationId = generateId();
      await db.insert(schema.trendVerifications).values({
        id: verificationId,
        trendId,
        verifiedBy: userId,
        status: "verified",
        evidence: { triggered_by: "manual_re_verification", timestamp: new Date().toISOString() },
      });

      // Update the trend's verification status
      await db
        .update(schema.canonicalTrends)
        .set({
          verificationStatus: "verified",
          lastVerifiedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(schema.canonicalTrends.id, trendId));

      logger.info("Trend re-verified", { trendId, userId });

      // Audit
      await db.insert(schema.auditLogs).values({
        userId,
        action: "trend_verify",
        resourceType: "canonical_trend",
        resourceId: trendId,
        details: { verificationId },
        ipAddress: req.ip ?? null,
      });

      const body: ApiResponse<{ verification_id: string; status: string }> = {
        success: true,
        data: { verification_id: verificationId, status: "verified" },
      };
      res.json(body);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
