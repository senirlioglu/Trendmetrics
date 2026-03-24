'use strict';

import type {
  PlatformId,
  RawTrendHit,
  ReliabilityTier,
  ConnectorRunResult,
} from '@trendmetrics/shared';
import { createChildLogger } from '../../config/logger.js';

const logger = createChildLogger({ module: 'connector-base' });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ConnectorCapabilities {
  supports_official_api: boolean;
  supports_search_discovery: boolean;
  supports_metadata_extraction: boolean;
  supports_metric_verification: boolean;
  reliability_tier: ReliabilityTier;
}

export interface DiscoverParams {
  category: string;
  country: string;
  language: string;
  seedQuery?: string;
}

// ---------------------------------------------------------------------------
// Circuit Breaker State
// ---------------------------------------------------------------------------

interface CircuitBreakerState {
  consecutiveFailures: number;
  lastFailureAt: number;
  isOpen: boolean;
}

const CIRCUIT_BREAKER_THRESHOLD = 3;
const CIRCUIT_BREAKER_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes
const DEFAULT_TIMEOUT_MS = 30_000; // 30 seconds

// ---------------------------------------------------------------------------
// Base Connector
// ---------------------------------------------------------------------------

export abstract class BaseConnector {
  abstract readonly platform: PlatformId;
  abstract readonly capabilities: ConnectorCapabilities;

  private circuitBreaker: CircuitBreakerState = {
    consecutiveFailures: 0,
    lastFailureAt: 0,
    isOpen: false,
  };

  /**
   * Platform-specific discovery logic. Subclasses implement this.
   */
  abstract discover(params: DiscoverParams): Promise<RawTrendHit[]>;

  /**
   * Template method: wraps discover with timeout, retry, and circuit breaker.
   */
  async execute(params: DiscoverParams): Promise<ConnectorRunResult> {
    // Check circuit breaker
    if (this.isCircuitOpen()) {
      logger.warn('Circuit breaker open, skipping connector', {
        platform: this.platform,
        cooldownRemainingMs:
          CIRCUIT_BREAKER_COOLDOWN_MS - (Date.now() - this.circuitBreaker.lastFailureAt),
      });
      return {
        connector: this.platform,
        status: 'failed',
        hits_count: 0,
        duration_ms: 0,
        error: 'Circuit breaker open — too many consecutive failures',
        reliability_tier: this.capabilities.reliability_tier,
      };
    }

    const startTime = Date.now();

    try {
      const hits = await this.withTimeout(this.discover(params), DEFAULT_TIMEOUT_MS);
      const durationMs = Date.now() - startTime;

      // Reset circuit breaker on success
      this.circuitBreaker.consecutiveFailures = 0;
      this.circuitBreaker.isOpen = false;

      logger.info('Connector execution succeeded', {
        platform: this.platform,
        hitsCount: hits.length,
        durationMs,
      });

      return {
        connector: this.platform,
        status: hits.length > 0 ? 'success' : 'partial',
        hits_count: hits.length,
        duration_ms: durationMs,
        reliability_tier: this.capabilities.reliability_tier,
      };
    } catch (err: unknown) {
      const durationMs = Date.now() - startTime;
      const errorMessage = err instanceof Error ? err.message : String(err);

      // Update circuit breaker
      this.circuitBreaker.consecutiveFailures++;
      this.circuitBreaker.lastFailureAt = Date.now();
      if (this.circuitBreaker.consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD) {
        this.circuitBreaker.isOpen = true;
        logger.error('Circuit breaker tripped', {
          platform: this.platform,
          consecutiveFailures: this.circuitBreaker.consecutiveFailures,
        });
      }

      logger.error('Connector execution failed', {
        platform: this.platform,
        durationMs,
        error: errorMessage,
      });

      return {
        connector: this.platform,
        status: 'failed',
        hits_count: 0,
        duration_ms: durationMs,
        error: errorMessage,
        reliability_tier: this.capabilities.reliability_tier,
      };
    }
  }

  /**
   * Generate a Google Search fallback URL for a given query on a platform.
   */
  protected generateSearchFallbackUrl(query: string, platform: string): string {
    const encoded = encodeURIComponent(`${query} site:${this.getPlatformDomain(platform)} trending`);
    return `https://www.google.com/search?q=${encoded}`;
  }

  private getPlatformDomain(platform: string): string {
    const domains: Record<string, string> = {
      youtube: 'youtube.com',
      tiktok: 'tiktok.com',
      instagram: 'instagram.com',
      facebook: 'facebook.com',
      'x-twitter': 'x.com',
      twitch: 'twitch.tv',
      amazon: 'amazon.com',
      trendyol: 'trendyol.com',
      hepsiburada: 'hepsiburada.com',
      sahibinden: 'sahibinden.com',
      'app-store': 'apps.apple.com',
      'google-play': 'play.google.com',
      airbnb: 'airbnb.com',
      tripadvisor: 'tripadvisor.com',
      booking: 'booking.com',
      'google-business': 'google.com/maps',
      'google-search': 'google.com',
      yandex: 'yandex.com',
    };
    return domains[platform] ?? `${platform}.com`;
  }

  private isCircuitOpen(): boolean {
    if (!this.circuitBreaker.isOpen) return false;
    // Check if cooldown has elapsed
    const elapsed = Date.now() - this.circuitBreaker.lastFailureAt;
    if (elapsed >= CIRCUIT_BREAKER_COOLDOWN_MS) {
      // Half-open: allow one attempt
      this.circuitBreaker.isOpen = false;
      this.circuitBreaker.consecutiveFailures = 0;
      logger.info('Circuit breaker reset after cooldown', { platform: this.platform });
      return false;
    }
    return true;
  }

  private withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Connector timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      promise
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((err: unknown) => {
          clearTimeout(timer);
          reject(err);
        });
    });
  }
}
