'use strict';

import type {
  PlatformId,
  PlatformGroupId,
  RawTrendHit,
  DiscoverRequest,
  ConnectorRunResult,
} from '@trendmetrics/shared';
import { PLATFORM_CONFIGS } from '@trendmetrics/shared';
import { ConnectorRegistry } from '../connector/registry.js';
import { CacheService } from '../cache/service.js';
import { createChildLogger } from '../../config/logger.js';
import type { DiscoverParams } from '../connector/base.js';

const logger = createChildLogger({ module: 'discovery-service' });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DiscoveryResult {
  hits: RawTrendHit[];
  connectorRuns: ConnectorRunResult[];
  cached: boolean;
}

// ---------------------------------------------------------------------------
// DiscoveryService
// ---------------------------------------------------------------------------

export class DiscoveryService {
  constructor(
    private readonly connectorRegistry: ConnectorRegistry,
    private readonly cacheService: CacheService,
  ) {}

  async discover(request: DiscoverRequest, userId: string): Promise<DiscoveryResult> {
    const { platform_group, category, country, language, seed_query, force_refresh } = request;

    logger.info('Discovery request received', {
      userId,
      platformGroup: platform_group,
      category,
      country,
      language,
      forceRefresh: force_refresh ?? false,
    });

    // 1. Build cache key
    const cacheKey = `hot:discovery:${platform_group}:${category}:${country}:${language}`;

    // 2. Check hot cache first (unless force refresh)
    if (!force_refresh) {
      const cached = await this.cacheService.get<DiscoveryResult>(cacheKey);
      if (cached) {
        logger.info('Discovery cache hit', {
          cacheKey,
          cacheLevel: cached.level,
          hitsCount: cached.data.hits.length,
        });
        return { ...cached.data, cached: true };
      }
    }

    // 3. Resolve which platforms to query
    const platforms = this.resolvePlatforms(platform_group);

    if (platforms.length === 0) {
      logger.warn('No connectors available for platform group', { platformGroup: platform_group });
      return { hits: [], connectorRuns: [], cached: false };
    }

    // 4. Run connectors in parallel
    const params: DiscoverParams = {
      category,
      country,
      language,
      seedQuery: seed_query,
    };

    const connectorPromises = platforms.map(async (platformId) => {
      const connector = this.connectorRegistry.getForPlatform(platformId);
      if (!connector) {
        return {
          result: {
            connector: platformId,
            status: 'failed' as const,
            hits_count: 0,
            duration_ms: 0,
            error: `No connector registered for ${platformId}`,
            reliability_tier: 'low' as const,
          },
          hits: [] as RawTrendHit[],
        };
      }

      // Execute connector (includes timeout and circuit breaker)
      const runResult = await connector.execute(params);

      // If successful, also get the actual hits
      let hits: RawTrendHit[] = [];
      if (runResult.status !== 'failed') {
        try {
          hits = await connector.discover(params);
        } catch (err: unknown) {
          logger.error('Failed to get hits after successful execute', {
            platform: platformId,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      return { result: runResult, hits };
    });

    const settled = await Promise.allSettled(connectorPromises);

    // 5. Collect results
    const allHits: RawTrendHit[] = [];
    const connectorRuns: ConnectorRunResult[] = [];

    for (const outcome of settled) {
      if (outcome.status === 'fulfilled') {
        connectorRuns.push(outcome.value.result);
        allHits.push(...outcome.value.hits);
      } else {
        logger.error('Connector promise rejected', {
          reason: outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason),
        });
      }
    }

    logger.info('Discovery completed', {
      userId,
      totalHits: allHits.length,
      connectorRuns: connectorRuns.map((r) => ({
        connector: r.connector,
        status: r.status,
        hits: r.hits_count,
        durationMs: r.duration_ms,
      })),
    });

    const result: DiscoveryResult = {
      hits: allHits,
      connectorRuns,
      cached: false,
    };

    // 6. Cache the result
    if (allHits.length > 0) {
      await this.cacheService.set(cacheKey, result, 'hot').catch((err: unknown) => {
        logger.error('Failed to cache discovery result', {
          error: err instanceof Error ? err.message : String(err),
        });
      });
    }

    return result;
  }

  private resolvePlatforms(platformGroup: PlatformGroupId): PlatformId[] {
    const platforms: PlatformId[] = [];
    for (const [id, platformConfig] of Object.entries(PLATFORM_CONFIGS)) {
      if (platformConfig.group === platformGroup) {
        platforms.push(id as PlatformId);
      }
    }
    return platforms;
  }
}
