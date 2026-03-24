'use strict';

import { v4 as uuidv4 } from 'uuid';
import type {
  RawTrendHit,
  CanonicalTrend,
  TrendSource,
  PlatformId,
} from '@trendmetrics/shared';
import { createChildLogger } from '../../config/logger.js';

const logger = createChildLogger({ module: 'normalization-service' });

// ---------------------------------------------------------------------------
// Platform-specific prefixes to strip
// ---------------------------------------------------------------------------

const PLATFORM_PREFIXES: Record<string, RegExp[]> = {
  youtube: [/^#\d+\s+on\s+trending\s*[-:]\s*/i, /^trending\s*[-:]\s*/i],
  tiktok: [/^#\w+\s*/g, /^fyp\s*/i],
  instagram: [/^#\w+\s*/g, /^reels?\s*[-:]\s*/i],
  'x-twitter': [/^rt\s+@\w+:\s*/i, /^#\w+\s*/g],
  'app-store': [/^new!\s*/i, /^updated!\s*/i],
  'google-play': [/^new!\s*/i, /^updated!\s*/i],
};

// ---------------------------------------------------------------------------
// Category Signal Keywords
// ---------------------------------------------------------------------------

const CATEGORY_SIGNALS: Record<string, string[]> = {
  Technology: ['ai', 'software', 'app', 'tech', 'gadget', 'startup', 'saas', 'cloud', 'crypto', 'blockchain'],
  'Fashion & Beauty': ['fashion', 'style', 'beauty', 'makeup', 'skincare', 'clothing', 'outfit', 'designer'],
  'Food & Beverage': ['recipe', 'food', 'restaurant', 'cooking', 'chef', 'meal', 'drink', 'beverage'],
  'Health & Fitness': ['health', 'fitness', 'workout', 'gym', 'wellness', 'nutrition', 'diet', 'exercise'],
  Entertainment: ['movie', 'series', 'show', 'celebrity', 'entertainment', 'film', 'actor', 'music video'],
  Gaming: ['game', 'gaming', 'esports', 'streamer', 'playstation', 'xbox', 'nintendo', 'steam'],
  'Finance & Crypto': ['finance', 'stock', 'invest', 'crypto', 'bitcoin', 'trading', 'market', 'economy'],
  'Travel & Tourism': ['travel', 'hotel', 'flight', 'destination', 'tourism', 'vacation', 'trip'],
  Sports: ['sport', 'football', 'soccer', 'basketball', 'tennis', 'nba', 'fifa', 'olympics'],
  Education: ['learn', 'education', 'course', 'tutorial', 'study', 'university', 'school'],
};

// ---------------------------------------------------------------------------
// NormalizationService
// ---------------------------------------------------------------------------

export class NormalizationService {
  normalize(hits: RawTrendHit[]): CanonicalTrend[] {
    logger.info('Normalizing raw trend hits', { inputCount: hits.length });

    const trends: CanonicalTrend[] = hits.map((hit) => {
      const cleanedTitle = this.cleanTitle(hit.title, hit.platform);
      const canonicalTitle = this.generateCanonicalTitle(cleanedTitle);
      const category = this.extractCategory(hit);
      const source = this.buildTrendSource(hit);
      const searchFallbackUrl = this.buildSearchFallbackUrl(canonicalTitle);

      return {
        id: uuidv4(),
        canonical_title: canonicalTitle,
        aliases: cleanedTitle !== canonicalTitle ? [cleanedTitle, hit.title] : [hit.title],
        category,
        country: '',
        language: '',
        source_platforms: [hit.platform],
        sources: [source],
        first_seen_at: hit.extracted_at,
        last_verified_at: hit.extracted_at,
        verification_status: 'unverified',
        evidence_level: this.determineInitialEvidenceLevel(hit),
        summary: hit.description || '',
        thumbnail_url: hit.thumbnail_url ?? '',
        search_fallback_url: searchFallbackUrl,
        // Scores — initialized to 0, filled by ScoringService
        momentum_score: 0,
        confidence_score: 0,
        cross_platform_score: 0,
        commercial_relevance_score: 0,
        freshness_score: 0,
        score_explanations: {},
        // Insights — filled by InsightService
        why_rising: '',
        who_cares: '',
        commercial_angle: '',
        brand_angle: '',
        ecommerce_angle: '',
        content_angle: '',
        risks: '',
        recommended_actions: [],
        business_use_cases: [],
        raw_signals: hit.raw_metrics,
      };
    });

    logger.info('Normalization completed', {
      inputCount: hits.length,
      outputCount: trends.length,
    });

    return trends;
  }

  // ---------------------------------------------------------------------------
  // Private Helpers
  // ---------------------------------------------------------------------------

  private cleanTitle(title: string, platform: PlatformId): string {
    let cleaned = title.trim();

    // Apply platform-specific prefix removal
    const prefixes = PLATFORM_PREFIXES[platform];
    if (prefixes) {
      for (const prefix of prefixes) {
        cleaned = cleaned.replace(prefix, '');
      }
    }

    // Remove excessive whitespace
    cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();

    // Remove leading/trailing special characters
    cleaned = cleaned.replace(/^[\-–—:|\s]+/, '').replace(/[\-–—:|\s]+$/, '');

    return cleaned;
  }

  private generateCanonicalTitle(cleanedTitle: string): string {
    // Title-case normalization: capitalize first letter of each major word
    const minorWords = new Set(['a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']);

    const words = cleanedTitle.split(/\s+/);
    const titleCased = words.map((word, index) => {
      const lower = word.toLowerCase();
      if (index === 0 || !minorWords.has(lower)) {
        return lower.charAt(0).toUpperCase() + lower.slice(1);
      }
      return lower;
    });

    return titleCased.join(' ');
  }

  private extractCategory(hit: RawTrendHit): string {
    const text = `${hit.title} ${hit.description}`.toLowerCase();

    let bestCategory = 'General';
    let bestScore = 0;

    for (const [category, keywords] of Object.entries(CATEGORY_SIGNALS)) {
      let score = 0;
      for (const keyword of keywords) {
        if (text.includes(keyword)) {
          score++;
        }
      }
      if (score > bestScore) {
        bestScore = score;
        bestCategory = category;
      }
    }

    return bestCategory;
  }

  private buildTrendSource(hit: RawTrendHit): TrendSource {
    return {
      platform: hit.platform,
      url: hit.source_url,
      title: hit.title,
      metrics: this.flattenMetrics(hit.raw_metrics),
      verified_at: hit.extracted_at,
      is_accessible: Boolean(hit.source_url),
      search_fallback_url: this.buildSearchFallbackUrl(hit.title),
    };
  }

  private flattenMetrics(raw: Record<string, unknown>): Record<string, string | number> {
    const flat: Record<string, string | number> = {};
    for (const [key, value] of Object.entries(raw)) {
      if (typeof value === 'string' || typeof value === 'number') {
        flat[key] = value;
      } else if (value !== null && value !== undefined) {
        flat[key] = String(value);
      }
    }
    return flat;
  }

  private determineInitialEvidenceLevel(
    hit: RawTrendHit,
  ): 'verified' | 'inferred' | 'weak_signal' | 'stale' {
    if (hit.confidence >= 0.8) return 'verified';
    if (hit.confidence >= 0.5) return 'inferred';
    return 'weak_signal';
  }

  private buildSearchFallbackUrl(query: string): string {
    const encoded = encodeURIComponent(`${query} trending`);
    return `https://www.google.com/search?q=${encoded}`;
  }
}
