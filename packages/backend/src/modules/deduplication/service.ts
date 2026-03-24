'use strict';

import type { CanonicalTrend } from '@trendmetrics/shared';
import { createChildLogger } from '../../config/logger.js';

const logger = createChildLogger({ module: 'deduplication-service' });

// ---------------------------------------------------------------------------
// Similarity Helpers
// ---------------------------------------------------------------------------

/**
 * Calculate Levenshtein distance between two strings.
 */
function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;

  if (m === 0) return n;
  if (n === 0) return m;

  // Use two-row approach for memory efficiency
  let prev: number[] = [];
  let curr: number[] = [];

  for (let j = 0; j <= n; j++) {
    prev[j] = j;
  }

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        (prev[j] ?? 0) + 1,
        (curr[j - 1] ?? 0) + 1,
        (prev[j - 1] ?? 0) + cost,
      );
    }
    [prev, curr] = [curr, prev];
  }

  return prev[n] ?? 0;
}

/**
 * Extract significant keywords from a string (removing stopwords).
 */
function extractKeywords(text: string): Set<string> {
  const stopwords = new Set([
    'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
    'has', 'have', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those',
    'it', 'its', 'my', 'your', 'his', 'her', 'our', 'their', 'what',
    'which', 'who', 'how', 'when', 'where', 'why', 'not', 'no', 'so',
    'if', 'than', 'too', 'very', 'just', 'about', 'up', 'out', 'new',
  ]);

  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !stopwords.has(w));

  return new Set(words);
}

/**
 * Calculate keyword overlap ratio between two keyword sets.
 */
function keywordOverlap(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 && setB.size === 0) return 1;
  if (setA.size === 0 || setB.size === 0) return 0;

  let intersection = 0;
  for (const word of setA) {
    if (setB.has(word)) intersection++;
  }

  const smaller = Math.min(setA.size, setB.size);
  return smaller > 0 ? intersection / smaller : 0;
}

/**
 * Calculate combined similarity score between two strings.
 * Returns a value between 0 (no similarity) and 1 (identical).
 */
export function calculateSimilarity(a: string, b: string): number {
  const normA = a.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
  const normB = b.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();

  if (normA === normB) return 1;
  if (normA.length === 0 || normB.length === 0) return 0;

  // Levenshtein-based similarity
  const maxLen = Math.max(normA.length, normB.length);
  const dist = levenshteinDistance(normA, normB);
  const levSimilarity = 1 - dist / maxLen;

  // Keyword overlap similarity
  const kwA = extractKeywords(normA);
  const kwB = extractKeywords(normB);
  const kwSimilarity = keywordOverlap(kwA, kwB);

  // Combined: weighted average (Levenshtein 40%, keyword overlap 60%)
  return levSimilarity * 0.4 + kwSimilarity * 0.6;
}

// ---------------------------------------------------------------------------
// DeduplicationService
// ---------------------------------------------------------------------------

export class DeduplicationService {
  private readonly similarityThreshold: number;
  private readonly keywordOverlapThreshold: number;

  constructor(similarityThreshold: number = 0.6, keywordOverlapThreshold: number = 0.6) {
    this.similarityThreshold = similarityThreshold;
    this.keywordOverlapThreshold = keywordOverlapThreshold;
  }

  deduplicate(trends: CanonicalTrend[]): CanonicalTrend[] {
    logger.info('Starting deduplication', { inputCount: trends.length });

    if (trends.length <= 1) return trends;

    // 1. Normalize all titles for comparison
    const normalized = trends.map((t) => ({
      trend: t,
      normTitle: t.canonical_title.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim(),
      keywords: extractKeywords(t.canonical_title),
    }));

    // 2. Build similarity groups using Union-Find
    const parent = new Array<number>(normalized.length);
    for (let i = 0; i < parent.length; i++) parent[i] = i;

    const find = (x: number): number => {
      let current = x;
      while (parent[current] !== current) {
        parent[current] = parent[parent[current]!]!; // path compression
        current = parent[current]!;
      }
      return current;
    };

    const union = (x: number, y: number): void => {
      const rx = find(x);
      const ry = find(y);
      if (rx !== ry) parent[rx] = ry;
    };

    // Compare all pairs
    for (let i = 0; i < normalized.length; i++) {
      for (let j = i + 1; j < normalized.length; j++) {
        const a = normalized[i]!;
        const b = normalized[j]!;

        // Quick check: exact normalized match
        if (a.normTitle === b.normTitle) {
          union(i, j);
          continue;
        }

        // Levenshtein check: distance < 0.3 of max length
        const maxLen = Math.max(a.normTitle.length, b.normTitle.length);
        const dist = levenshteinDistance(a.normTitle, b.normTitle);
        if (maxLen > 0 && dist < maxLen * 0.3) {
          union(i, j);
          continue;
        }

        // Keyword overlap > threshold
        const overlap = keywordOverlap(a.keywords, b.keywords);
        if (overlap > this.keywordOverlapThreshold) {
          union(i, j);
          continue;
        }

        // General similarity above threshold
        const sim = calculateSimilarity(a.trend.canonical_title, b.trend.canonical_title);
        if (sim >= this.similarityThreshold) {
          union(i, j);
        }
      }
    }

    // 3. Group by root
    const groups = new Map<number, number[]>();
    for (let i = 0; i < normalized.length; i++) {
      const root = find(i);
      const group = groups.get(root);
      if (group) {
        group.push(i);
      } else {
        groups.set(root, [i]);
      }
    }

    // 4. Merge each group
    const merged: CanonicalTrend[] = [];

    for (const indices of groups.values()) {
      if (indices.length === 1) {
        merged.push(normalized[indices[0]!]!.trend);
        continue;
      }

      const groupTrends = indices.map((i) => normalized[i]!.trend);
      merged.push(this.mergeGroup(groupTrends));
    }

    logger.info('Deduplication completed', {
      inputCount: trends.length,
      outputCount: merged.length,
      mergedGroups: trends.length - merged.length,
    });

    return merged;
  }

  // ---------------------------------------------------------------------------
  // Private: Merge a group of similar trends
  // ---------------------------------------------------------------------------

  private mergeGroup(trends: CanonicalTrend[]): CanonicalTrend {
    // Pick the "best" trend as the base (most sources, highest confidence)
    const sorted = [...trends].sort((a, b) => {
      const sourcesDiff = b.sources.length - a.sources.length;
      if (sourcesDiff !== 0) return sourcesDiff;
      return b.confidence_score - a.confidence_score;
    });

    const base = { ...sorted[0]! };

    // Collect all unique aliases
    const aliasSet = new Set<string>(base.aliases);
    for (const t of trends) {
      aliasSet.add(t.canonical_title);
      for (const alias of t.aliases) {
        aliasSet.add(alias);
      }
    }
    // Remove the canonical title from aliases
    aliasSet.delete(base.canonical_title);
    base.aliases = Array.from(aliasSet);

    // Merge sources (avoid duplicate platform+url combos)
    const sourceKeys = new Set<string>();
    const mergedSources: typeof base.sources = [];
    for (const t of trends) {
      for (const source of t.sources) {
        const key = `${source.platform}:${source.url}`;
        if (!sourceKeys.has(key)) {
          sourceKeys.add(key);
          mergedSources.push(source);
        }
      }
    }
    base.sources = mergedSources;

    // Merge source platforms
    const platformSet = new Set(base.source_platforms);
    for (const t of trends) {
      for (const p of t.source_platforms) {
        platformSet.add(p);
      }
    }
    base.source_platforms = Array.from(platformSet);

    // Boost cross_platform_score based on number of unique platforms
    const uniquePlatforms = platformSet.size;
    if (uniquePlatforms >= 3) {
      base.cross_platform_score = Math.min(100, base.cross_platform_score + 30);
    } else if (uniquePlatforms >= 2) {
      base.cross_platform_score = Math.min(100, base.cross_platform_score + 15);
    }

    // Update score explanation
    base.score_explanations = {
      ...base.score_explanations,
      cross_platform_score: `Found on ${uniquePlatforms} platform(s): ${Array.from(platformSet).join(', ')}. Score: ${base.cross_platform_score}/100.`,
    };

    // Pick best thumbnail (prefer non-empty)
    for (const t of sorted) {
      if (t.thumbnail_url) {
        base.thumbnail_url = t.thumbnail_url;
        break;
      }
    }

    // Use earliest first_seen_at
    for (const t of trends) {
      if (t.first_seen_at < base.first_seen_at) {
        base.first_seen_at = t.first_seen_at;
      }
    }

    // Use latest last_verified_at
    for (const t of trends) {
      if (t.last_verified_at > base.last_verified_at) {
        base.last_verified_at = t.last_verified_at;
      }
    }

    return base;
  }
}
