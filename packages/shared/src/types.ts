// ---------------------------------------------------------------------------
// Evidence & Confidence
// ---------------------------------------------------------------------------

export type EvidenceLevel = 'verified' | 'inferred' | 'weak_signal' | 'stale';

export type VerificationStatus =
  | 'verified'
  | 'partially_verified'
  | 'weak_signal'
  | 'stale'
  | 'unverified';

export type ReliabilityTier = 'high' | 'medium' | 'low';

// ---------------------------------------------------------------------------
// Platform System
// ---------------------------------------------------------------------------

export type PlatformId =
  | 'youtube'
  | 'tiktok'
  | 'instagram'
  | 'facebook'
  | 'x-twitter'
  | 'twitch'
  | 'amazon'
  | 'trendyol'
  | 'hepsiburada'
  | 'sahibinden'
  | 'app-store'
  | 'google-play'
  | 'airbnb'
  | 'tripadvisor'
  | 'booking'
  | 'google-business'
  | 'google-search'
  | 'yandex';

export type PlatformGroupId =
  | 'social-media'
  | 'e-commerce'
  | 'app-stores'
  | 'travel-local'
  | 'search-engines';

export interface PlatformCapability {
  supports_official_api: boolean;
  supports_search_discovery: boolean;
  supports_metadata_extraction: boolean;
  supports_metric_verification: boolean;
  reliability_tier: ReliabilityTier;
}

export interface PlatformConfig {
  id: PlatformId;
  name: string;
  group: PlatformGroupId;
  capabilities: PlatformCapability;
  icon: string;
  color: string;
}

// ---------------------------------------------------------------------------
// Trend Data
// ---------------------------------------------------------------------------

export interface RawTrendHit {
  id: string;
  query_id: string;
  platform: PlatformId;
  title: string;
  description: string;
  source_url: string;
  thumbnail_url?: string;
  raw_metrics: Record<string, unknown>;
  extracted_at: Date;
  confidence: number; // 0-1
}

export interface TrendSource {
  platform: PlatformId;
  url: string;
  title: string;
  metrics: Record<string, string | number>;
  verified_at: Date | null;
  is_accessible: boolean;
  search_fallback_url: string;
}

export interface CanonicalTrend {
  id: string;
  canonical_title: string;
  aliases: string[];
  category: string;
  country: string;
  language: string;
  source_platforms: PlatformId[];
  sources: TrendSource[];
  first_seen_at: Date;
  last_verified_at: Date;
  verification_status: VerificationStatus;
  evidence_level: EvidenceLevel;
  summary: string;
  thumbnail_url: string;
  search_fallback_url: string;
  // Scores
  momentum_score: number;
  confidence_score: number;
  cross_platform_score: number;
  commercial_relevance_score: number;
  freshness_score: number;
  // Score explanations
  score_explanations: Record<string, string>;
  // Insights
  why_rising: string;
  who_cares: string;
  commercial_angle: string;
  brand_angle: string;
  ecommerce_angle: string;
  content_angle: string;
  risks: string;
  recommended_actions: string[];
  business_use_cases: string[];
  // Raw
  raw_signals: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

export interface DeepAnalysisReport {
  id: string;
  trend_id: string;
  user_id: string;
  content_markdown: string;
  data_layers: {
    verified_data: string[];
    inferred_insights: string[];
    weak_signals: string[];
  };
  generated_at: Date;
  cost: number;
  model_used: string;
}

export interface DailyReport {
  id: string;
  user_id: string;
  platform_group: PlatformGroupId;
  category: string;
  country: string;
  content_markdown: string;
  trend_count: number;
  generated_at: Date;
}

// ---------------------------------------------------------------------------
// Credits
// ---------------------------------------------------------------------------

export interface CreditTransaction {
  id: string;
  user_id: string;
  type: 'topup' | 'deep_analysis' | 'force_refresh' | 'daily_report' | 'refund';
  amount: number;
  balance_after: number;
  description: string;
  idempotency_key: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  created_at: Date;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export interface TrendQuery {
  id: string;
  user_id: string;
  platform_group: PlatformGroupId;
  platforms: PlatformId[];
  category: string;
  country: string;
  language: string;
  seed_query?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  created_at: Date;
  completed_at?: Date;
}

// ---------------------------------------------------------------------------
// Connector
// ---------------------------------------------------------------------------

export interface ConnectorRunResult {
  connector: PlatformId;
  status: 'success' | 'partial' | 'failed';
  hits_count: number;
  duration_ms: number;
  error?: string;
  reliability_tier: ReliabilityTier;
}

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

export type CacheLevel = 'hot' | 'daily' | 'history';

export interface CacheEntry {
  key: string;
  level: CacheLevel;
  data: unknown;
  created_at: Date;
  expires_at: Date;
  hit_count: number;
}

// ---------------------------------------------------------------------------
// API Responses
// ---------------------------------------------------------------------------

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
  meta?: { cached: boolean; cache_level?: CacheLevel; generated_at: string };
}

// ---------------------------------------------------------------------------
// Discovery Request
// ---------------------------------------------------------------------------

export interface DiscoverRequest {
  platform_group: PlatformGroupId;
  category: string;
  country: string;
  language: string;
  seed_query?: string;
  force_refresh?: boolean;
}

// ---------------------------------------------------------------------------
// User
// ---------------------------------------------------------------------------

export interface UserProfile {
  uid: string;
  email: string;
  display_name: string;
  photo_url: string;
  balance: number;
  created_at: Date;
  last_login: Date;
}

// ---------------------------------------------------------------------------
// Scoring Explanation
// ---------------------------------------------------------------------------

export interface ScoreBreakdown {
  score_name: string;
  value: number;
  max_value: number;
  factors: { name: string; contribution: number; explanation: string }[];
}

// ---------------------------------------------------------------------------
// Comparison
// ---------------------------------------------------------------------------

export interface ComparisonResult {
  trends: CanonicalTrend[];
  comparison_summary: string;
  winner_by_metric: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------

export interface AuditLogEntry {
  id: string;
  user_id: string;
  action: string;
  resource_type: string;
  resource_id: string;
  details: Record<string, unknown>;
  ip_address?: string;
  created_at: Date;
}

// ---------------------------------------------------------------------------
// Constants: Platform Configs
// ---------------------------------------------------------------------------

export const PLATFORM_CONFIGS: Record<PlatformId, PlatformConfig> = {
  youtube: {
    id: 'youtube',
    name: 'YouTube',
    group: 'social-media',
    capabilities: {
      supports_official_api: true,
      supports_search_discovery: true,
      supports_metadata_extraction: true,
      supports_metric_verification: true,
      reliability_tier: 'high',
    },
    icon: 'youtube',
    color: '#FF0000',
  },
  tiktok: {
    id: 'tiktok',
    name: 'TikTok',
    group: 'social-media',
    capabilities: {
      supports_official_api: false,
      supports_search_discovery: true,
      supports_metadata_extraction: true,
      supports_metric_verification: false,
      reliability_tier: 'medium',
    },
    icon: 'tiktok',
    color: '#000000',
  },
  instagram: {
    id: 'instagram',
    name: 'Instagram',
    group: 'social-media',
    capabilities: {
      supports_official_api: false,
      supports_search_discovery: true,
      supports_metadata_extraction: true,
      supports_metric_verification: false,
      reliability_tier: 'medium',
    },
    icon: 'instagram',
    color: '#E4405F',
  },
  facebook: {
    id: 'facebook',
    name: 'Facebook',
    group: 'social-media',
    capabilities: {
      supports_official_api: true,
      supports_search_discovery: true,
      supports_metadata_extraction: true,
      supports_metric_verification: true,
      reliability_tier: 'high',
    },
    icon: 'facebook',
    color: '#1877F2',
  },
  'x-twitter': {
    id: 'x-twitter',
    name: 'X (Twitter)',
    group: 'social-media',
    capabilities: {
      supports_official_api: true,
      supports_search_discovery: true,
      supports_metadata_extraction: true,
      supports_metric_verification: true,
      reliability_tier: 'high',
    },
    icon: 'x-twitter',
    color: '#000000',
  },
  twitch: {
    id: 'twitch',
    name: 'Twitch',
    group: 'social-media',
    capabilities: {
      supports_official_api: true,
      supports_search_discovery: true,
      supports_metadata_extraction: true,
      supports_metric_verification: true,
      reliability_tier: 'high',
    },
    icon: 'twitch',
    color: '#9146FF',
  },
  amazon: {
    id: 'amazon',
    name: 'Amazon',
    group: 'e-commerce',
    capabilities: {
      supports_official_api: false,
      supports_search_discovery: true,
      supports_metadata_extraction: true,
      supports_metric_verification: false,
      reliability_tier: 'medium',
    },
    icon: 'amazon',
    color: '#FF9900',
  },
  trendyol: {
    id: 'trendyol',
    name: 'Trendyol',
    group: 'e-commerce',
    capabilities: {
      supports_official_api: false,
      supports_search_discovery: true,
      supports_metadata_extraction: false,
      supports_metric_verification: false,
      reliability_tier: 'low',
    },
    icon: 'trendyol',
    color: '#F27A1A',
  },
  hepsiburada: {
    id: 'hepsiburada',
    name: 'Hepsiburada',
    group: 'e-commerce',
    capabilities: {
      supports_official_api: false,
      supports_search_discovery: true,
      supports_metadata_extraction: false,
      supports_metric_verification: false,
      reliability_tier: 'low',
    },
    icon: 'hepsiburada',
    color: '#FF6000',
  },
  sahibinden: {
    id: 'sahibinden',
    name: 'Sahibinden',
    group: 'e-commerce',
    capabilities: {
      supports_official_api: false,
      supports_search_discovery: true,
      supports_metadata_extraction: false,
      supports_metric_verification: false,
      reliability_tier: 'low',
    },
    icon: 'sahibinden',
    color: '#FFE800',
  },
  'app-store': {
    id: 'app-store',
    name: 'App Store',
    group: 'app-stores',
    capabilities: {
      supports_official_api: false,
      supports_search_discovery: true,
      supports_metadata_extraction: true,
      supports_metric_verification: false,
      reliability_tier: 'medium',
    },
    icon: 'app-store',
    color: '#0D96F6',
  },
  'google-play': {
    id: 'google-play',
    name: 'Google Play',
    group: 'app-stores',
    capabilities: {
      supports_official_api: false,
      supports_search_discovery: true,
      supports_metadata_extraction: true,
      supports_metric_verification: false,
      reliability_tier: 'medium',
    },
    icon: 'google-play',
    color: '#34A853',
  },
  airbnb: {
    id: 'airbnb',
    name: 'Airbnb',
    group: 'travel-local',
    capabilities: {
      supports_official_api: false,
      supports_search_discovery: true,
      supports_metadata_extraction: true,
      supports_metric_verification: false,
      reliability_tier: 'medium',
    },
    icon: 'airbnb',
    color: '#FF5A5F',
  },
  tripadvisor: {
    id: 'tripadvisor',
    name: 'Tripadvisor',
    group: 'travel-local',
    capabilities: {
      supports_official_api: false,
      supports_search_discovery: true,
      supports_metadata_extraction: true,
      supports_metric_verification: false,
      reliability_tier: 'medium',
    },
    icon: 'tripadvisor',
    color: '#34E0A1',
  },
  booking: {
    id: 'booking',
    name: 'Booking.com',
    group: 'travel-local',
    capabilities: {
      supports_official_api: false,
      supports_search_discovery: true,
      supports_metadata_extraction: true,
      supports_metric_verification: false,
      reliability_tier: 'medium',
    },
    icon: 'booking',
    color: '#003580',
  },
  'google-business': {
    id: 'google-business',
    name: 'Google Business',
    group: 'travel-local',
    capabilities: {
      supports_official_api: false,
      supports_search_discovery: true,
      supports_metadata_extraction: false,
      supports_metric_verification: false,
      reliability_tier: 'low',
    },
    icon: 'google-business',
    color: '#4285F4',
  },
  'google-search': {
    id: 'google-search',
    name: 'Google Search',
    group: 'search-engines',
    capabilities: {
      supports_official_api: false,
      supports_search_discovery: true,
      supports_metadata_extraction: true,
      supports_metric_verification: false,
      reliability_tier: 'high',
    },
    icon: 'google-search',
    color: '#4285F4',
  },
  yandex: {
    id: 'yandex',
    name: 'Yandex',
    group: 'search-engines',
    capabilities: {
      supports_official_api: false,
      supports_search_discovery: true,
      supports_metadata_extraction: true,
      supports_metric_verification: false,
      reliability_tier: 'medium',
    },
    icon: 'yandex',
    color: '#FF0000',
  },
} as const;

// ---------------------------------------------------------------------------
// Constants: Categories
// ---------------------------------------------------------------------------

export const CATEGORIES: string[] = [
  'Technology',
  'Fashion & Beauty',
  'Food & Beverage',
  'Health & Fitness',
  'Entertainment',
  'Gaming',
  'Finance & Crypto',
  'Travel & Tourism',
  'Home & Garden',
  'Sports',
  'Education',
  'Music',
  'Automotive',
  'Pets & Animals',
  'News & Politics',
  'Science',
  'Art & Design',
  'Business & Marketing',
  'Parenting & Family',
  'Real Estate',
];

// ---------------------------------------------------------------------------
// Constants: Countries
// ---------------------------------------------------------------------------

export const COUNTRIES: string[] = [
  'US',
  'GB',
  'TR',
  'DE',
  'FR',
  'ES',
  'IT',
  'NL',
  'BR',
  'IN',
  'JP',
  'KR',
  'AU',
  'CA',
  'MX',
  'RU',
  'SA',
  'AE',
  'PL',
  'SE',
];
