import type { CanonicalTrend, DiscoverRequest, RawTrendHit } from "@trendmetrics/shared";
import { createChildLogger } from "../../config/logger.js";

// ---------------------------------------------------------------------------
// Placeholder service interfaces.  Concrete implementations live in their own
// files and are injected through the constructor so the pipeline stays testable.
// ---------------------------------------------------------------------------

export interface DiscoveryService {
  discover(request: DiscoverRequest): Promise<RawTrendHit[]>;
}

export interface NormalizationService {
  normalize(hits: RawTrendHit[]): Promise<CanonicalTrend[]>;
}

export interface DeduplicationService {
  deduplicate(trends: CanonicalTrend[]): Promise<CanonicalTrend[]>;
}

export interface VerificationService {
  verify(trends: CanonicalTrend[]): Promise<CanonicalTrend[]>;
}

export interface ScoringService {
  score(trends: CanonicalTrend[]): Promise<CanonicalTrend[]>;
}

export interface InsightService {
  generateInsights(trends: CanonicalTrend[]): Promise<CanonicalTrend[]>;
}

// ---------------------------------------------------------------------------
// Step timing helper
// ---------------------------------------------------------------------------

interface StepResult<T> {
  data: T;
  durationMs: number;
}

async function timed<T>(label: string, fn: () => Promise<T>, log: ReturnType<typeof createChildLogger>): Promise<StepResult<T>> {
  const start = performance.now();
  try {
    const data = await fn();
    const durationMs = Math.round(performance.now() - start);
    log.info(`Pipeline step completed`, { step: label, durationMs });
    return { data, durationMs };
  } catch (err) {
    const durationMs = Math.round(performance.now() - start);
    log.warn(`Pipeline step failed`, { step: label, durationMs, error: (err as Error).message });
    throw err;
  }
}

// ---------------------------------------------------------------------------
// TrendPipeline
// ---------------------------------------------------------------------------

const MAX_RESULTS = 20;

export class TrendPipeline {
  private readonly log;

  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly normalizationService: NormalizationService,
    private readonly deduplicationService: DeduplicationService,
    private readonly verificationService: VerificationService,
    private readonly scoringService: ScoringService,
    private readonly insightService: InsightService,
  ) {
    this.log = createChildLogger({ component: "TrendPipeline" });
  }

  /**
   * Execute the full trend-discovery pipeline.
   *
   * Each step is individually timed and logged. Steps that fail after
   * discovery are treated as non-fatal -- the pipeline returns whatever
   * partial results it can assemble (graceful degradation).
   */
  async execute(request: DiscoverRequest, userId: string): Promise<CanonicalTrend[]> {
    const pipelineStart = performance.now();
    this.log.info("Pipeline started", { userId, request });

    // Step 1 -- Discovery (fatal if it fails: no data to work with)
    const { data: rawHits } = await timed(
      "discovery",
      () => this.discoveryService.discover(request),
      this.log,
    );

    if (rawHits.length === 0) {
      this.log.info("No raw hits returned -- pipeline finished early", { userId });
      return [];
    }

    // Step 2 -- Normalization
    let trends: CanonicalTrend[];
    try {
      const result = await timed(
        "normalization",
        () => this.normalizationService.normalize(rawHits),
        this.log,
      );
      trends = result.data;
    } catch {
      this.log.warn("Normalization failed; returning empty result set");
      return [];
    }

    // Step 3 -- Deduplication (non-fatal)
    try {
      const result = await timed(
        "deduplication",
        () => this.deduplicationService.deduplicate(trends),
        this.log,
      );
      trends = result.data;
    } catch {
      this.log.warn("Deduplication failed; continuing with un-deduped trends");
    }

    // Step 4 -- Verification (non-fatal)
    try {
      const result = await timed(
        "verification",
        () => this.verificationService.verify(trends),
        this.log,
      );
      trends = result.data;
    } catch {
      this.log.warn("Verification failed; continuing without verification data");
    }

    // Step 5 -- Scoring (non-fatal)
    try {
      const result = await timed(
        "scoring",
        () => this.scoringService.score(trends),
        this.log,
      );
      trends = result.data;
    } catch {
      this.log.warn("Scoring failed; trends will have default scores");
    }

    // Step 6 -- Insight generation (non-fatal)
    try {
      const result = await timed(
        "insights",
        () => this.insightService.generateInsights(trends),
        this.log,
      );
      trends = result.data;
    } catch {
      this.log.warn("Insight generation failed; continuing without insights");
    }

    // Step 7 -- Sort by momentum_score desc
    trends.sort((a, b) => (b.momentum_score ?? 0) - (a.momentum_score ?? 0));

    // Step 8 -- Take top N
    const result = trends.slice(0, MAX_RESULTS);

    const totalMs = Math.round(performance.now() - pipelineStart);
    this.log.info("Pipeline completed", {
      userId,
      totalMs,
      rawHits: rawHits.length,
      returned: result.length,
    });

    return result;
  }
}
