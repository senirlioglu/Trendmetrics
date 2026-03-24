'use strict';

import type {
  CanonicalTrend,
  VerificationStatus,
  EvidenceLevel,
} from '@trendmetrics/shared';
import { createChildLogger } from '../../config/logger.js';

const logger = createChildLogger({ module: 'verification-service' });

// ---------------------------------------------------------------------------
// Internal Types
// ---------------------------------------------------------------------------

interface VerificationAssessment {
  status: VerificationStatus;
  evidenceLevel: EvidenceLevel;
  reasons: string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STALE_THRESHOLD_MS = 48 * 60 * 60 * 1000; // 48 hours
const VERY_STALE_THRESHOLD_MS = 72 * 60 * 60 * 1000; // 72 hours

// ---------------------------------------------------------------------------
// VerificationService
// ---------------------------------------------------------------------------

export class VerificationService {
  verify(trends: CanonicalTrend[]): CanonicalTrend[] {
    logger.info('Starting verification', { inputCount: trends.length });

    const verified = trends.map((trend) => {
      const assessment = this.assessTrend(trend);

      logger.debug('Trend verified', {
        trendId: trend.id,
        title: trend.canonical_title,
        status: assessment.status,
        evidenceLevel: assessment.evidenceLevel,
        reasons: assessment.reasons,
      });

      return {
        ...trend,
        verification_status: assessment.status,
        evidence_level: assessment.evidenceLevel,
        last_verified_at: new Date(),
        search_fallback_url:
          trend.search_fallback_url || this.generateFallbackUrl(trend.canonical_title),
        sources: trend.sources.map((source) => ({
          ...source,
          search_fallback_url:
            source.search_fallback_url ||
            this.generatePlatformFallbackUrl(trend.canonical_title, source.platform),
        })),
        score_explanations: {
          ...trend.score_explanations,
          verification: `Status: ${assessment.status}. ${assessment.reasons.join(' ')}`,
        },
      };
    });

    const counts = {
      verified: 0,
      partially_verified: 0,
      weak_signal: 0,
      stale: 0,
      unverified: 0,
    };
    for (const t of verified) {
      counts[t.verification_status]++;
    }
    logger.info('Verification completed', { inputCount: trends.length, ...counts });

    return verified;
  }

  // ---------------------------------------------------------------------------
  // Private: Assessment Logic
  // ---------------------------------------------------------------------------

  private assessTrend(trend: CanonicalTrend): VerificationAssessment {
    const reasons: string[] = [];
    const sourceCount = trend.sources.length;
    const uniquePlatforms = new Set(trend.sources.map((s) => s.platform));
    const platformCount = uniquePlatforms.size;

    // Check freshness of last_verified_at
    const lastVerifiedAge = trend.last_verified_at
      ? Date.now() - new Date(trend.last_verified_at).getTime()
      : Infinity;

    // Check if any source has recent verification
    const hasRecentSource = trend.sources.some((s) => {
      if (!s.verified_at) return false;
      const age = Date.now() - new Date(s.verified_at).getTime();
      return age < STALE_THRESHOLD_MS;
    });

    // Check staleness
    if (lastVerifiedAge > VERY_STALE_THRESHOLD_MS && !hasRecentSource) {
      reasons.push(
        `No activity detected in ${Math.round(lastVerifiedAge / (60 * 60 * 1000))}+ hours.`,
      );
      return { status: 'stale', evidenceLevel: 'stale', reasons };
    }

    // Verified: 3+ independent sources across 2+ platforms
    if (sourceCount >= 3 && platformCount >= 2) {
      reasons.push(
        `${sourceCount} independent sources across ${platformCount} platforms (${Array.from(uniquePlatforms).join(', ')}).`,
      );
      if (hasRecentSource) {
        reasons.push('Recent activity confirmed within 48h.');
      }
      return { status: 'verified', evidenceLevel: 'verified', reasons };
    }

    // Partially verified: 2+ sources
    if (sourceCount >= 2) {
      reasons.push(
        `${sourceCount} sources found, but limited platform diversity (${platformCount} platform${platformCount === 1 ? '' : 's'}).`,
      );
      if (hasRecentSource) {
        reasons.push('At least one source is recent.');
      }
      return { status: 'partially_verified', evidenceLevel: 'inferred', reasons };
    }

    // Weak signal: 1 source
    if (sourceCount === 1) {
      const source = trend.sources[0];
      reasons.push(
        `Only 1 source found on ${source?.platform ?? 'unknown'}. Treat as early signal.`,
      );
      return { status: 'weak_signal', evidenceLevel: 'weak_signal', reasons };
    }

    // Unverified: no sources
    reasons.push('No verifiable sources found.');
    return { status: 'unverified', evidenceLevel: 'weak_signal', reasons };
  }

  // ---------------------------------------------------------------------------
  // Fallback URL Generators
  // ---------------------------------------------------------------------------

  private generateFallbackUrl(title: string): string {
    return `https://www.google.com/search?q=${encodeURIComponent(`${title} trend`)}`;
  }

  private generatePlatformFallbackUrl(title: string, platform: string): string {
    const encodedTitle = encodeURIComponent(title);
    const platformSearchUrls: Record<string, string> = {
      youtube: `https://www.youtube.com/results?search_query=${encodedTitle}`,
      tiktok: `https://www.tiktok.com/search?q=${encodedTitle}`,
      instagram: `https://www.instagram.com/explore/tags/${encodeURIComponent(title.replace(/\s+/g, ''))}`,
      'x-twitter': `https://twitter.com/search?q=${encodedTitle}&src=trend_click`,
      amazon: `https://www.amazon.com/s?k=${encodedTitle}`,
      trendyol: `https://www.trendyol.com/sr?q=${encodedTitle}`,
      hepsiburada: `https://www.hepsiburada.com/ara?q=${encodedTitle}`,
      sahibinden: `https://www.sahibinden.com/arama?query_text=${encodedTitle}`,
      'google-play': `https://play.google.com/store/search?q=${encodedTitle}`,
      'app-store': `https://www.google.com/search?q=${encodeURIComponent(`${title} site:apps.apple.com`)}`,
      airbnb: `https://www.airbnb.com/s/${encodedTitle}/homes`,
      tripadvisor: `https://www.tripadvisor.com/Search?q=${encodedTitle}`,
      booking: `https://www.booking.com/searchresults.html?ss=${encodedTitle}`,
      'google-business': `https://www.google.com/maps/search/${encodedTitle}`,
      'google-search': `https://trends.google.com/trends/explore?q=${encodedTitle}`,
      yandex: `https://yandex.com/search/?text=${encodedTitle}`,
    };

    return platformSearchUrls[platform] ?? this.generateFallbackUrl(title);
  }
}
