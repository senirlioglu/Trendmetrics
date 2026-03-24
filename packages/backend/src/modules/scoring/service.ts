'use strict';

import type { CanonicalTrend } from '@trendmetrics/shared';
import { createChildLogger } from '../../config/logger.js';

const logger = createChildLogger({ module: 'scoring-service' });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ScoreFactor {
  name: string;
  contribution: number;
  explanation: string;
}

interface ScoreResult {
  score: number;
  factors: ScoreFactor[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COMMERCIAL_CATEGORIES = new Set([
  'Technology', 'Fashion & Beauty', 'Food & Beverage', 'Health & Fitness',
  'Gaming', 'Finance & Crypto', 'Automotive', 'Real Estate',
  'Business & Marketing', 'Home & Garden',
]);

const COMMERCIAL_KEYWORDS = [
  'buy', 'sale', 'deal', 'product', 'brand', 'shop', 'price',
  'launch', 'release', 'store', 'discount', 'offer', 'review',
  'unbox', 'sponsor', 'collab', 'partnership',
];

const PLATFORM_GROUP_MAP: Record<string, string> = {
  youtube: 'social', tiktok: 'social', instagram: 'social', facebook: 'social',
  'x-twitter': 'social', twitch: 'social',
  amazon: 'ecommerce', trendyol: 'ecommerce', hepsiburada: 'ecommerce', sahibinden: 'ecommerce',
  'app-store': 'apps', 'google-play': 'apps',
  airbnb: 'travel', tripadvisor: 'travel', booking: 'travel', 'google-business': 'travel',
  'google-search': 'search', yandex: 'search',
};

const ECOMMERCE_PLATFORMS = new Set(['amazon', 'trendyol', 'hepsiburada', 'sahibinden']);

// ---------------------------------------------------------------------------
// ScoringService
// ---------------------------------------------------------------------------

export class ScoringService {
  score(trends: CanonicalTrend[]): CanonicalTrend[] {
    logger.info('Starting scoring', { inputCount: trends.length });

    const scored = trends.map((trend) => {
      const momentum = this.calculateMomentum(trend);
      const confidence = this.calculateConfidence(trend);
      const crossPlatform = this.calculateCrossPlatform(trend);
      const commercial = this.calculateCommercialRelevance(trend);
      const freshness = this.calculateFreshness(trend);

      return {
        ...trend,
        momentum_score: momentum.score,
        confidence_score: confidence.score,
        cross_platform_score: crossPlatform.score,
        commercial_relevance_score: commercial.score,
        freshness_score: freshness.score,
        score_explanations: {
          ...trend.score_explanations,
          momentum_score: this.formatExplanation('Momentum', momentum.score, momentum.factors),
          confidence_score: this.formatExplanation('Confidence', confidence.score, confidence.factors),
          cross_platform_score: this.formatExplanation('Cross-Platform', crossPlatform.score, crossPlatform.factors),
          commercial_relevance_score: this.formatExplanation('Commercial Relevance', commercial.score, commercial.factors),
          freshness_score: this.formatExplanation('Freshness', freshness.score, freshness.factors),
        },
      };
    });

    const avgMomentum = this.average(scored.map((t) => t.momentum_score));
    const avgConfidence = this.average(scored.map((t) => t.confidence_score));
    logger.info('Scoring completed', { inputCount: trends.length, avgMomentum, avgConfidence });

    return scored;
  }

  // ---------------------------------------------------------------------------
  // Momentum Score (0-100)
  // Based on: growth signals, recency, engagement velocity, source count
  // ---------------------------------------------------------------------------

  private calculateMomentum(trend: CanonicalTrend): ScoreResult {
    const factors: ScoreFactor[] = [];
    let score = 0;

    // Factor 1: Source volume (max 30)
    const sourcePoints = Math.min(30, trend.sources.length * 10);
    factors.push({
      name: 'Source volume',
      contribution: sourcePoints,
      explanation: `${trend.sources.length} source(s) found`,
    });
    score += sourcePoints;

    // Factor 2: Platform diversity (max 30)
    const platforms = new Set(trend.source_platforms).size;
    const platformPoints = Math.min(30, platforms * 15);
    factors.push({
      name: 'Platform diversity',
      contribution: platformPoints,
      explanation: `Present on ${platforms} platform(s)`,
    });
    score += platformPoints;

    // Factor 3: Recency (max 25)
    const ageHours = trend.last_verified_at
      ? (Date.now() - new Date(trend.last_verified_at).getTime()) / (1000 * 60 * 60)
      : 48;
    const recencyPoints = ageHours < 1 ? 25
      : ageHours < 4 ? 20
      : ageHours < 12 ? 15
      : ageHours < 24 ? 10
      : ageHours < 48 ? 5 : 0;
    factors.push({
      name: 'Recency',
      contribution: recencyPoints,
      explanation: `Last verified ${ageHours < 1 ? '< 1 hour' : `${Math.round(ageHours)} hours`} ago`,
    });
    score += recencyPoints;

    // Factor 4: Verification status (max 15)
    const verificationPoints =
      trend.verification_status === 'verified' ? 15
      : trend.verification_status === 'partially_verified' ? 10
      : trend.verification_status === 'weak_signal' ? 4 : 0;
    factors.push({
      name: 'Verification',
      contribution: verificationPoints,
      explanation: `Status: ${trend.verification_status}`,
    });
    score += verificationPoints;

    return { score: Math.min(100, score), factors };
  }

  // ---------------------------------------------------------------------------
  // Confidence Score (0-100)
  // Based on: source count, source quality, verification status, evidence level
  // ---------------------------------------------------------------------------

  private calculateConfidence(trend: CanonicalTrend): ScoreResult {
    const factors: ScoreFactor[] = [];
    let score = 0;

    // Factor 1: Source count (max 25)
    const sourcePoints = Math.min(25, trend.sources.length * 8);
    factors.push({
      name: 'Source count',
      contribution: sourcePoints,
      explanation: `${trend.sources.length} independent source(s)`,
    });
    score += sourcePoints;

    // Factor 2: Source quality — accessible sources (max 25)
    const accessibleCount = trend.sources.filter((s) => s.is_accessible).length;
    const qualityPoints =
      trend.sources.length > 0
        ? Math.round((accessibleCount / trend.sources.length) * 25)
        : 0;
    factors.push({
      name: 'Source quality',
      contribution: qualityPoints,
      explanation: `${accessibleCount}/${trend.sources.length} sources accessible`,
    });
    score += qualityPoints;

    // Factor 3: Verification status (max 25)
    const verifPoints =
      trend.verification_status === 'verified' ? 25
      : trend.verification_status === 'partially_verified' ? 15
      : trend.verification_status === 'weak_signal' ? 5 : 0;
    factors.push({
      name: 'Verification level',
      contribution: verifPoints,
      explanation: `Status: ${trend.verification_status}`,
    });
    score += verifPoints;

    // Factor 4: Evidence level (max 25)
    const evidencePoints =
      trend.evidence_level === 'verified' ? 25
      : trend.evidence_level === 'inferred' ? 15
      : trend.evidence_level === 'weak_signal' ? 5 : 0;
    factors.push({
      name: 'Evidence level',
      contribution: evidencePoints,
      explanation: `Evidence: ${trend.evidence_level}`,
    });
    score += evidencePoints;

    return { score: Math.min(100, score), factors };
  }

  // ---------------------------------------------------------------------------
  // Cross-Platform Score (0-100)
  // Based on: number of unique platforms, platform group diversity
  // ---------------------------------------------------------------------------

  private calculateCrossPlatform(trend: CanonicalTrend): ScoreResult {
    const factors: ScoreFactor[] = [];

    const platforms = new Set(trend.source_platforms);
    const count = platforms.size;

    // Factor 1: Platform count (max 60)
    const basePoints = Math.min(60, count * 20);
    factors.push({
      name: 'Platform count',
      contribution: basePoints,
      explanation: `Found on ${count} platform(s): ${Array.from(platforms).join(', ')}`,
    });

    // Factor 2: Group diversity bonus (max 40)
    const groups = new Set<string>();
    for (const p of platforms) {
      const group = PLATFORM_GROUP_MAP[p];
      if (group) groups.add(group);
    }
    const diversityPoints = Math.min(40, groups.size * 15);
    factors.push({
      name: 'Group diversity',
      contribution: diversityPoints,
      explanation: `Spans ${groups.size} platform group(s)`,
    });

    // Use existing cross_platform_score if already boosted (by dedup), pick higher
    const computed = Math.min(100, basePoints + diversityPoints);
    const finalScore = Math.max(trend.cross_platform_score, computed);

    return { score: finalScore, factors };
  }

  // ---------------------------------------------------------------------------
  // Commercial Relevance Score (0-100)
  // Based on: category value, brand/product signals, e-commerce presence, metrics
  // ---------------------------------------------------------------------------

  private calculateCommercialRelevance(trend: CanonicalTrend): ScoreResult {
    const factors: ScoreFactor[] = [];
    let score = 0;

    // Factor 1: Category commercial value (max 30)
    const isCommercial = COMMERCIAL_CATEGORIES.has(trend.category);
    const catPoints = isCommercial ? 30 : 15;
    factors.push({
      name: 'Category signal',
      contribution: catPoints,
      explanation: `Category "${trend.category}" has ${isCommercial ? 'high' : 'moderate'} commercial value`,
    });
    score += catPoints;

    // Factor 2: E-commerce platform presence (max 30)
    const ecomPresent = trend.source_platforms.filter((p) => ECOMMERCE_PLATFORMS.has(p)).length;
    const ecomPoints = Math.min(30, ecomPresent * 15);
    factors.push({
      name: 'E-commerce signal',
      contribution: ecomPoints,
      explanation: ecomPresent > 0
        ? `Present on ${ecomPresent} e-commerce platform(s)`
        : 'No e-commerce platform presence',
    });
    score += ecomPoints;

    // Factor 3: Commercial keywords (max 20)
    const titleLower = `${trend.canonical_title} ${trend.summary}`.toLowerCase();
    const keywordHits = COMMERCIAL_KEYWORDS.filter((k) => titleLower.includes(k)).length;
    const keywordPoints = Math.min(20, keywordHits * 7);
    factors.push({
      name: 'Commercial keywords',
      contribution: keywordPoints,
      explanation: keywordHits > 0
        ? `${keywordHits} commercial keyword(s) detected`
        : 'No strong commercial keywords',
    });
    score += keywordPoints;

    // Factor 4: Engagement metrics availability (max 20)
    const hasMetrics = trend.sources.some((s) => Object.keys(s.metrics).length > 0);
    const metricPoints = hasMetrics ? 20 : 5;
    factors.push({
      name: 'Engagement signals',
      contribution: metricPoints,
      explanation: hasMetrics
        ? 'Engagement metrics available from sources'
        : 'No direct engagement metrics available',
    });
    score += metricPoints;

    return { score: Math.min(100, score), factors };
  }

  // ---------------------------------------------------------------------------
  // Freshness Score (0-100)
  // Based on: time since first seen, time since last verified, active lifespan
  // ---------------------------------------------------------------------------

  private calculateFreshness(trend: CanonicalTrend): ScoreResult {
    const factors: ScoreFactor[] = [];
    const now = Date.now();

    const firstSeen = trend.first_seen_at ? new Date(trend.first_seen_at).getTime() : now;
    const lastVerified = trend.last_verified_at ? new Date(trend.last_verified_at).getTime() : firstSeen;

    // Factor 1: Last verification age (max 50)
    const ageSinceVerifiedHours = (now - lastVerified) / (1000 * 60 * 60);
    const freshnessPoints =
      ageSinceVerifiedHours < 1 ? 50
      : ageSinceVerifiedHours < 4 ? 40
      : ageSinceVerifiedHours < 12 ? 30
      : ageSinceVerifiedHours < 24 ? 20
      : ageSinceVerifiedHours < 48 ? 10 : 0;
    factors.push({
      name: 'Last verification age',
      contribution: freshnessPoints,
      explanation: `Last verified ${ageSinceVerifiedHours < 1 ? '< 1 hour' : `${Math.round(ageSinceVerifiedHours)} hours`} ago`,
    });

    // Factor 2: Trend age — newer trends get bonus (max 30)
    const totalAgeHours = (now - firstSeen) / (1000 * 60 * 60);
    const emergingBonus = totalAgeHours < 24 ? 30
      : totalAgeHours < 72 ? 20 : 10;
    const ageLabel = totalAgeHours < 24 ? 'emerging'
      : totalAgeHours < 72 ? 'active' : 'established';
    factors.push({
      name: 'Trend age',
      contribution: emergingBonus,
      explanation: `First seen ${totalAgeHours < 24 ? '< 24 hours' : `${Math.round(totalAgeHours / 24)} days`} ago (${ageLabel})`,
    });

    // Factor 3: Recent source updates (max 20)
    const recentSources = trend.sources.filter((s) => {
      if (!s.verified_at) return false;
      return (now - new Date(s.verified_at).getTime()) < 12 * 60 * 60 * 1000;
    }).length;
    const recentPoints = Math.min(20, recentSources * 10);
    factors.push({
      name: 'Recent source updates',
      contribution: recentPoints,
      explanation: `${recentSources} source(s) updated in last 12 hours`,
    });

    const finalScore = Math.min(100, freshnessPoints + emergingBonus + recentPoints);
    return { score: finalScore, factors };
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private formatExplanation(name: string, score: number, factors: ScoreFactor[]): string {
    const factorDetails = factors
      .map((f) => `${f.name}: +${f.contribution}pts (${f.explanation})`)
      .join('. ');
    return `${name} (${score}/100): ${factorDetails}`;
  }

  private average(values: number[]): number {
    if (values.length === 0) return 0;
    return Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);
  }
}
