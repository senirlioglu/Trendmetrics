'use strict';

import { v4 as uuidv4 } from 'uuid';
import type { PlatformId, RawTrendHit } from '@trendmetrics/shared';
import { BaseConnector, type ConnectorCapabilities, type DiscoverParams } from './base.js';
import { type AIProvider, getAIProvider } from '../../providers/ai.js';
import { createChildLogger } from '../../config/logger.js';

const logger = createChildLogger({ module: 'grounded-search-connector' });

// ---------------------------------------------------------------------------
// Platform-Specific Prompt Templates
// ---------------------------------------------------------------------------

const PLATFORM_PROMPT_TEMPLATES: Record<string, string> = {
  tiktok: `You are a trend analyst for TikTok. Search for the current trending content, hashtags, and viral videos on TikTok for the category "{category}" in {country} ({language}).
Find the top 10 currently trending items. For each, provide the title, a brief description, and a real TikTok URL if available.`,

  instagram: `You are a trend analyst for Instagram. Search for the current trending reels, posts, hashtags, and accounts on Instagram for the category "{category}" in {country} ({language}).
Find the top 10 currently trending items. For each, provide the title, a brief description, and a real Instagram URL if available.`,

  trendyol: `You are a trend analyst for Trendyol (Turkish e-commerce). Search for the current best-selling and trending products on Trendyol in the category "{category}" for {country} ({language}).
Find the top 10 currently trending products. For each, provide the product name, a brief description, and a real Trendyol URL if available.`,

  hepsiburada: `You are a trend analyst for Hepsiburada (Turkish e-commerce). Search for the current best-selling and trending products on Hepsiburada in the category "{category}" for {country} ({language}).
Find the top 10 currently trending products. For each, provide the product name, a brief description, and a real Hepsiburada URL if available.`,

  sahibinden: `You are a trend analyst for Sahibinden.com (Turkish classifieds). Search for the most popular and trending listings on Sahibinden in the category "{category}" for {country} ({language}).
Find the top 10 currently trending items. For each, provide the listing title, a brief description, and a real Sahibinden URL if available.`,

  'app-store': `You are a trend analyst for the Apple App Store. Search for the current top trending and most downloaded apps on the App Store in the category "{category}" for {country} ({language}).
Find the top 10 currently trending apps. For each, provide the app name, a brief description, and a real App Store URL if available.`,

  'google-play': `You are a trend analyst for Google Play Store. Search for the current top trending and most downloaded apps on Google Play in the category "{category}" for {country} ({language}).
Find the top 10 currently trending apps. For each, provide the app name, a brief description, and a real Google Play URL if available.`,

  airbnb: `You are a trend analyst for Airbnb. Search for the current trending destinations, experiences, and popular listings on Airbnb for the category "{category}" in {country} ({language}).
Find the top 10 currently trending items. For each, provide the title, a brief description, and a real Airbnb URL if available.`,

  tripadvisor: `You are a trend analyst for Tripadvisor. Search for the current trending destinations, restaurants, and experiences on Tripadvisor for the category "{category}" in {country} ({language}).
Find the top 10 currently trending items. For each, provide the title, a brief description, and a real Tripadvisor URL if available.`,

  booking: `You are a trend analyst for Booking.com. Search for the current trending destinations, hotels, and accommodations on Booking.com for the category "{category}" in {country} ({language}).
Find the top 10 currently trending items. For each, provide the title, a brief description, and a real Booking.com URL if available.`,

  'google-business': `You are a trend analyst for Google Business / Google Maps. Search for the current trending and popular businesses, restaurants, and local services on Google Maps for the category "{category}" in {country} ({language}).
Find the top 10 currently trending items. For each, provide the business name, a brief description, and a real Google Maps URL if available.`,

  amazon: `You are a trend analyst for Amazon. Search for the current best-selling and trending products on Amazon in the category "{category}" for {country} ({language}).
Find the top 10 currently trending products. For each, provide the product name, a brief description, and a real Amazon URL if available.`,

  facebook: `You are a trend analyst for Facebook. Search for the current trending topics, pages, and viral content on Facebook for the category "{category}" in {country} ({language}).
Find the top 10 currently trending items. For each, provide the title, a brief description, and a real Facebook URL if available.`,

  'x-twitter': `You are a trend analyst for X (formerly Twitter). Search for the current trending topics, hashtags, and viral posts on X for the category "{category}" in {country} ({language}).
Find the top 10 currently trending items. For each, provide the title, a brief description, and a real X URL if available.`,

  twitch: `You are a trend analyst for Twitch. Search for the current trending streams, categories, and games on Twitch for the category "{category}" in {country} ({language}).
Find the top 10 currently trending items. For each, provide the title, a brief description, and a real Twitch URL if available.`,

  'google-search': `You are a trend analyst for Google Search. Search for the current trending search queries and topics on Google for the category "{category}" in {country} ({language}).
Find the top 10 currently trending search items. For each, provide the query/title, a brief description, and a real Google Trends URL if available.`,

  yandex: `You are a trend analyst for Yandex. Search for the current trending search queries and topics on Yandex for the category "{category}" in {country} ({language}).
Find the top 10 currently trending items. For each, provide the query/title, a brief description, and a real Yandex URL if available.`,
};

const DEFAULT_PROMPT_TEMPLATE = `You are a trend analyst for the platform "{platform}". Search for the current trending content in the category "{category}" in {country} ({language}).
Find the top 10 currently trending items. For each, provide the title, a brief description, and a real URL if available.`;

// ---------------------------------------------------------------------------
// Response Schema
// ---------------------------------------------------------------------------

const RESPONSE_SCHEMA = `[
  {
    "title": "string - the trend title/name",
    "description": "string - a brief description of the trend",
    "source_url": "string - a real URL to the original content (empty string if unavailable)",
    "thumbnail_url": "string - thumbnail or image URL if available (empty string if unavailable)",
    "metrics": {
      "estimated_engagement": "string - estimated engagement level (high/medium/low)",
      "growth_signal": "string - brief growth indicator"
    }
  }
]`;

// ---------------------------------------------------------------------------
// Parsed Response Item
// ---------------------------------------------------------------------------

interface GroundedSearchItem {
  title: string;
  description: string;
  source_url: string;
  thumbnail_url?: string;
  metrics?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// GroundedSearchConnector
// ---------------------------------------------------------------------------

export class GroundedSearchConnector extends BaseConnector {
  readonly platform: PlatformId;
  readonly capabilities: ConnectorCapabilities;
  private readonly aiProvider: AIProvider;

  constructor(platformId: PlatformId) {
    super();
    this.platform = platformId;
    this.aiProvider = getAIProvider();
    this.capabilities = {
      supports_official_api: false,
      supports_search_discovery: true,
      supports_metadata_extraction: true,
      supports_metric_verification: false,
      reliability_tier: 'medium',
    };
  }

  async discover(params: DiscoverParams): Promise<RawTrendHit[]> {
    const { category, country, language, seedQuery } = params;
    const queryId = uuidv4();

    const promptTemplate =
      PLATFORM_PROMPT_TEMPLATES[this.platform] ?? DEFAULT_PROMPT_TEMPLATE;

    let prompt = promptTemplate
      .replace(/\{category\}/g, category)
      .replace(/\{country\}/g, country)
      .replace(/\{language\}/g, language)
      .replace(/\{platform\}/g, this.platform);

    if (seedQuery) {
      prompt += `\n\nAdditional context/seed query: "${seedQuery}"`;
    }

    prompt += `\n\nIMPORTANT: Use Google Search to find REAL, CURRENT trending data. Do NOT invent or guess. If you cannot find real data for an item, omit it. Only include items you found evidence for via search.`;

    logger.info('Running grounded search discovery', {
      platform: this.platform,
      category,
      country,
      language,
    });

    const items = await this.aiProvider.generateStructuredContent<GroundedSearchItem[]>(
      prompt,
      RESPONSE_SCHEMA,
      { temperature: 0.3, useGrounding: true },
    );

    if (!Array.isArray(items)) {
      logger.warn('Grounded search returned non-array response', { platform: this.platform });
      return [];
    }

    const hits: RawTrendHit[] = items
      .filter((item) => item.title && typeof item.title === 'string')
      .map((item) => ({
        id: uuidv4(),
        query_id: queryId,
        platform: this.platform,
        title: item.title,
        description: item.description || '',
        source_url:
          item.source_url || this.generateSearchFallbackUrl(item.title, this.platform),
        thumbnail_url: item.thumbnail_url || undefined,
        raw_metrics: (item.metrics as Record<string, unknown>) ?? {},
        extracted_at: new Date(),
        confidence: item.source_url ? 0.6 : 0.3,
      }));

    logger.info('Grounded search discovery completed', {
      platform: this.platform,
      hitsCount: hits.length,
    });

    return hits;
  }
}

// ---------------------------------------------------------------------------
// Supported platforms for grounded search
// ---------------------------------------------------------------------------

export const GROUNDED_SEARCH_PLATFORMS: PlatformId[] = [
  'tiktok',
  'instagram',
  'trendyol',
  'hepsiburada',
  'sahibinden',
  'app-store',
  'google-play',
  'airbnb',
  'tripadvisor',
  'booking',
  'google-business',
  'amazon',
  'facebook',
  'x-twitter',
  'twitch',
  'google-search',
  'yandex',
];
