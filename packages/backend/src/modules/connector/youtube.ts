'use strict';

import { v4 as uuidv4 } from 'uuid';
import type { PlatformId, RawTrendHit } from '@trendmetrics/shared';
import { BaseConnector, type ConnectorCapabilities, type DiscoverParams } from './base.js';
import { type AIProvider, getAIProvider } from '../../providers/ai.js';
import { createChildLogger } from '../../config/logger.js';

const logger = createChildLogger({ module: 'youtube-connector' });

// ---------------------------------------------------------------------------
// YouTube API Response Types
// ---------------------------------------------------------------------------

interface YouTubeApiTrendingItem {
  id: string;
  snippet: {
    title: string;
    description: string;
    thumbnails: {
      high?: { url: string };
      medium?: { url: string };
      default?: { url: string };
    };
    channelTitle: string;
    publishedAt: string;
    categoryId: string;
  };
  statistics?: {
    viewCount?: string;
    likeCount?: string;
    commentCount?: string;
  };
}

interface YouTubeApiResponse {
  items: YouTubeApiTrendingItem[];
  pageInfo: {
    totalResults: number;
    resultsPerPage: number;
  };
}

// ---------------------------------------------------------------------------
// Country code mapping for YouTube regionCode
// ---------------------------------------------------------------------------

const YOUTUBE_REGION_MAP: Record<string, string> = {
  US: 'US',
  GB: 'GB',
  TR: 'TR',
  DE: 'DE',
  FR: 'FR',
  ES: 'ES',
  IT: 'IT',
  NL: 'NL',
  BR: 'BR',
  IN: 'IN',
  JP: 'JP',
  KR: 'KR',
  AU: 'AU',
  CA: 'CA',
  MX: 'MX',
  RU: 'RU',
  SA: 'SA',
  AE: 'AE',
  PL: 'PL',
  SE: 'SE',
};

// ---------------------------------------------------------------------------
// Grounded Search Schema
// ---------------------------------------------------------------------------

const GROUNDED_SCHEMA = `[
  {
    "title": "string - video title",
    "description": "string - brief description",
    "source_url": "string - real YouTube video URL",
    "thumbnail_url": "string - thumbnail URL if available",
    "channel": "string - channel name",
    "metrics": {
      "views": "string - estimated view count",
      "engagement": "string - high/medium/low"
    }
  }
]`;

interface GroundedYouTubeItem {
  title: string;
  description: string;
  source_url: string;
  thumbnail_url?: string;
  channel?: string;
  metrics?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// YouTubeConnector
// ---------------------------------------------------------------------------

export class YouTubeConnector extends BaseConnector {
  readonly platform: PlatformId = 'youtube';
  readonly capabilities: ConnectorCapabilities;
  private readonly apiKey: string | null;
  private readonly aiProvider: AIProvider;

  constructor() {
    super();
    this.apiKey = process.env['YOUTUBE_API_KEY'] ?? null;
    this.aiProvider = getAIProvider();
    this.capabilities = {
      supports_official_api: this.apiKey !== null,
      supports_search_discovery: true,
      supports_metadata_extraction: true,
      supports_metric_verification: this.apiKey !== null,
      reliability_tier: this.apiKey ? 'high' : 'medium',
    };
  }

  async discover(params: DiscoverParams): Promise<RawTrendHit[]> {
    if (this.apiKey) {
      logger.info('Using YouTube Data API v3 for discovery', {
        country: params.country,
        category: params.category,
      });
      return this.discoverViaApi(params);
    }

    logger.info('No YouTube API key, falling back to grounded search', {
      country: params.country,
      category: params.category,
    });
    return this.discoverViaGroundedSearch(params);
  }

  // ---------------------------------------------------------------------------
  // Official API Discovery
  // ---------------------------------------------------------------------------

  private async discoverViaApi(params: DiscoverParams): Promise<RawTrendHit[]> {
    const { category, country } = params;
    const queryId = uuidv4();
    const regionCode = YOUTUBE_REGION_MAP[country] ?? 'US';

    const url = new URL('https://www.googleapis.com/youtube/v3/videos');
    url.searchParams.set('part', 'snippet,statistics');
    url.searchParams.set('chart', 'mostPopular');
    url.searchParams.set('regionCode', regionCode);
    url.searchParams.set('maxResults', '25');
    url.searchParams.set('key', this.apiKey!);

    const response = await fetch(url.toString());

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`YouTube API error ${String(response.status)}: ${body.slice(0, 200)}`);
    }

    const data = (await response.json()) as YouTubeApiResponse;

    if (!data.items || !Array.isArray(data.items)) {
      logger.warn('YouTube API returned no items', { regionCode, category });
      return [];
    }

    // Filter by category keyword matching (YouTube API category IDs are numeric,
    // so we do a best-effort title/description filter)
    const categoryLower = category.toLowerCase();
    const filteredItems = data.items.filter((item) => {
      const text = `${item.snippet.title} ${item.snippet.description}`.toLowerCase();
      // Loose match: include all if category is broad
      return (
        categoryLower === 'all' ||
        text.includes(categoryLower) ||
        data.items.length <= 10
      );
    });

    const itemsToUse = filteredItems.length > 0 ? filteredItems : data.items.slice(0, 10);

    const hits: RawTrendHit[] = itemsToUse.map((item) => {
      const thumbnail =
        item.snippet.thumbnails.high?.url ??
        item.snippet.thumbnails.medium?.url ??
        item.snippet.thumbnails.default?.url;

      return {
        id: uuidv4(),
        query_id: queryId,
        platform: 'youtube' as PlatformId,
        title: item.snippet.title,
        description: item.snippet.description.slice(0, 500),
        source_url: `https://www.youtube.com/watch?v=${item.id}`,
        thumbnail_url: thumbnail,
        raw_metrics: {
          viewCount: item.statistics?.viewCount ?? null,
          likeCount: item.statistics?.likeCount ?? null,
          commentCount: item.statistics?.commentCount ?? null,
          channelTitle: item.snippet.channelTitle,
          publishedAt: item.snippet.publishedAt,
          categoryId: item.snippet.categoryId,
        },
        extracted_at: new Date(),
        confidence: 0.9, // High confidence from official API
      };
    });

    logger.info('YouTube API discovery completed', {
      regionCode,
      totalResults: data.pageInfo.totalResults,
      returnedHits: hits.length,
    });

    return hits;
  }

  // ---------------------------------------------------------------------------
  // Grounded Search Fallback
  // ---------------------------------------------------------------------------

  private async discoverViaGroundedSearch(params: DiscoverParams): Promise<RawTrendHit[]> {
    const { category, country, language, seedQuery } = params;
    const queryId = uuidv4();

    let prompt = `You are a trend analyst for YouTube. Search for the current trending and most popular YouTube videos in the category "${category}" for ${country} (${language}).
Find the top 10 currently trending YouTube videos. For each, provide the video title, a brief description, and a real YouTube video URL.`;

    if (seedQuery) {
      prompt += `\n\nAdditional search focus: "${seedQuery}"`;
    }

    prompt += `\n\nIMPORTANT: Use Google Search to find REAL, CURRENT trending YouTube videos. Do NOT invent or guess. Only include videos you found evidence for.`;

    const items = await this.aiProvider.generateStructuredContent<GroundedYouTubeItem[]>(
      prompt,
      GROUNDED_SCHEMA,
      { temperature: 0.3, useGrounding: true },
    );

    if (!Array.isArray(items)) {
      logger.warn('YouTube grounded search returned non-array response');
      return [];
    }

    const hits: RawTrendHit[] = items
      .filter((item) => item.title && typeof item.title === 'string')
      .map((item) => ({
        id: uuidv4(),
        query_id: queryId,
        platform: 'youtube' as PlatformId,
        title: item.title,
        description: item.description || '',
        source_url:
          item.source_url || this.generateSearchFallbackUrl(item.title, 'youtube'),
        thumbnail_url: item.thumbnail_url || undefined,
        raw_metrics: {
          channel: item.channel ?? null,
          ...(item.metrics as Record<string, unknown> ?? {}),
        },
        extracted_at: new Date(),
        confidence: item.source_url ? 0.6 : 0.3,
      }));

    logger.info('YouTube grounded search completed', { hitsCount: hits.length });
    return hits;
  }
}
