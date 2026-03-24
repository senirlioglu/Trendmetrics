-- 0001_initial.sql
-- TrendMetrics initial schema migration

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

CREATE TYPE credit_transaction_type AS ENUM (
  'signup_bonus',
  'purchase',
  'deep_analysis',
  'force_refresh',
  'daily_report',
  'refund',
  'admin_adjustment'
);

CREATE TYPE credit_transaction_status AS ENUM (
  'pending',
  'completed',
  'failed',
  'reversed'
);

CREATE TYPE trend_query_status AS ENUM (
  'pending',
  'running',
  'completed',
  'failed',
  'cancelled'
);

CREATE TYPE verification_status AS ENUM (
  'unverified',
  'verified',
  'disputed',
  'expired'
);

CREATE TYPE evidence_level AS ENUM (
  'low',
  'medium',
  'high',
  'confirmed'
);

CREATE TYPE trend_report_type AS ENUM (
  'deep_analysis',
  'comparison'
);

CREATE TYPE connector_run_status AS ENUM (
  'pending',
  'running',
  'completed',
  'failed'
);

CREATE TYPE cache_level AS ENUM (
  'hot',
  'daily',
  'history'
);

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firebase_uid VARCHAR(128) NOT NULL UNIQUE,
  email VARCHAR(320) NOT NULL,
  display_name VARCHAR(255),
  photo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE user_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  balance DECIMAL(10,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type credit_transaction_type NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  balance_after DECIMAL(10,2) NOT NULL,
  description TEXT,
  idempotency_key VARCHAR(255) UNIQUE,
  status credit_transaction_status NOT NULL DEFAULT 'pending',
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE trend_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform_group VARCHAR(100),
  platforms TEXT[],
  category VARCHAR(100),
  country VARCHAR(10),
  language VARCHAR(10),
  seed_query TEXT,
  status trend_query_status NOT NULL DEFAULT 'pending',
  hit_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE raw_trend_hits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_id UUID NOT NULL REFERENCES trend_queries(id) ON DELETE CASCADE,
  platform VARCHAR(100) NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  source_url TEXT,
  thumbnail_url TEXT,
  raw_metrics JSONB,
  extracted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  confidence DECIMAL(5,4)
);

CREATE TABLE canonical_trends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_title TEXT NOT NULL,
  aliases TEXT[],
  category VARCHAR(100),
  country VARCHAR(10),
  language VARCHAR(10),
  source_platforms TEXT[],
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_verified_at TIMESTAMPTZ,
  verification_status verification_status NOT NULL DEFAULT 'unverified',
  evidence_level evidence_level NOT NULL DEFAULT 'low',
  summary TEXT,
  thumbnail_url TEXT,
  search_fallback_url TEXT,

  -- Scores
  momentum_score DECIMAL(7,4),
  confidence_score DECIMAL(7,4),
  cross_platform_score DECIMAL(7,4),
  commercial_relevance_score DECIMAL(7,4),
  freshness_score DECIMAL(7,4),
  score_explanations JSONB,

  -- AI-generated insights
  why_rising TEXT,
  who_cares TEXT,
  commercial_angle TEXT,
  brand_angle TEXT,
  ecommerce_angle TEXT,
  content_angle TEXT,
  risks TEXT,
  recommended_actions TEXT[],
  business_use_cases TEXT[],
  raw_signals JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE trend_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trend_id UUID NOT NULL REFERENCES canonical_trends(id) ON DELETE CASCADE,
  platform VARCHAR(100) NOT NULL,
  url TEXT,
  title TEXT,
  metrics JSONB,
  verified_at TIMESTAMPTZ,
  is_accessible BOOLEAN,
  search_fallback_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE trend_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trend_id UUID NOT NULL REFERENCES canonical_trends(id) ON DELETE CASCADE,
  verified_by TEXT NOT NULL,
  status verification_status NOT NULL,
  evidence JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE trend_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trend_id UUID NOT NULL REFERENCES canonical_trends(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  report_type trend_report_type NOT NULL,
  content_markdown TEXT,
  data_layers JSONB,
  model_used VARCHAR(100),
  cost DECIMAL(10,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE daily_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform_group VARCHAR(100),
  category VARCHAR(100),
  country VARCHAR(10),
  content_markdown TEXT,
  trend_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE connector_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_id UUID NOT NULL REFERENCES trend_queries(id) ON DELETE CASCADE,
  connector_id VARCHAR(100) NOT NULL,
  status connector_run_status NOT NULL DEFAULT 'pending',
  hits_count INTEGER DEFAULT 0,
  duration_ms INTEGER,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE cache_entries (
  key TEXT PRIMARY KEY,
  level cache_level NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  hit_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(100),
  resource_id VARCHAR(255),
  details JSONB,
  ip_address VARCHAR(45),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

CREATE INDEX idx_canonical_trends_category_country ON canonical_trends(category, country);
CREATE INDEX idx_canonical_trends_momentum ON canonical_trends(momentum_score);
CREATE INDEX idx_credit_transactions_user_created ON credit_transactions(user_id, created_at);
CREATE INDEX idx_cache_entries_expires_at ON cache_entries(expires_at);
CREATE INDEX idx_audit_logs_user_created ON audit_logs(user_id, created_at);
