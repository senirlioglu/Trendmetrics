import {
  pgTable,
  pgEnum,
  uuid,
  text,
  varchar,
  timestamp,
  decimal,
  integer,
  boolean,
  jsonb,
  index,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const creditTransactionTypeEnum = pgEnum("credit_transaction_type", [
  "signup_bonus",
  "purchase",
  "deep_analysis",
  "force_refresh",
  "daily_report",
  "refund",
  "admin_adjustment",
]);

export const creditTransactionStatusEnum = pgEnum("credit_transaction_status", [
  "pending",
  "completed",
  "failed",
  "reversed",
]);

export const trendQueryStatusEnum = pgEnum("trend_query_status", [
  "pending",
  "running",
  "completed",
  "failed",
  "cancelled",
]);

export const verificationStatusEnum = pgEnum("verification_status", [
  "unverified",
  "verified",
  "disputed",
  "expired",
]);

export const evidenceLevelEnum = pgEnum("evidence_level", [
  "low",
  "medium",
  "high",
  "confirmed",
]);

export const trendReportTypeEnum = pgEnum("trend_report_type", [
  "deep_analysis",
  "comparison",
]);

export const connectorRunStatusEnum = pgEnum("connector_run_status", [
  "pending",
  "running",
  "completed",
  "failed",
]);

export const cacheLevelEnum = pgEnum("cache_level", [
  "hot",
  "daily",
  "history",
]);

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  firebaseUid: varchar("firebase_uid", { length: 128 }).notNull().unique(),
  email: varchar("email", { length: 320 }).notNull(),
  displayName: varchar("display_name", { length: 255 }),
  photoUrl: text("photo_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const userBalances = pgTable("user_balances", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" })
    .unique(),
  balance: decimal("balance", { precision: 10, scale: 2 }).notNull().default("0"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const creditTransactions = pgTable(
  "credit_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: creditTransactionTypeEnum("type").notNull(),
    amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
    balanceAfter: decimal("balance_after", { precision: 10, scale: 2 }).notNull(),
    description: text("description"),
    idempotencyKey: varchar("idempotency_key", { length: 255 }).unique(),
    status: creditTransactionStatusEnum("status").notNull().default("pending"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    idx_credit_transactions_user_created: index("idx_credit_transactions_user_created").on(table.userId, table.createdAt),
  }),
);

export const trendQueries = pgTable("trend_queries", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  platformGroup: varchar("platform_group", { length: 100 }),
  platforms: text("platforms").array(),
  category: varchar("category", { length: 100 }),
  country: varchar("country", { length: 10 }),
  language: varchar("language", { length: 10 }),
  seedQuery: text("seed_query"),
  status: trendQueryStatusEnum("status").notNull().default("pending"),
  hitCount: integer("hit_count").default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const rawTrendHits = pgTable("raw_trend_hits", {
  id: uuid("id").primaryKey().defaultRandom(),
  queryId: uuid("query_id")
    .notNull()
    .references(() => trendQueries.id, { onDelete: "cascade" }),
  platform: varchar("platform", { length: 100 }).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  sourceUrl: text("source_url"),
  thumbnailUrl: text("thumbnail_url"),
  rawMetrics: jsonb("raw_metrics"),
  extractedAt: timestamp("extracted_at", { withTimezone: true }).notNull().defaultNow(),
  confidence: decimal("confidence", { precision: 5, scale: 4 }),
});

export const canonicalTrends = pgTable(
  "canonical_trends",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    canonicalTitle: text("canonical_title").notNull(),
    aliases: text("aliases").array(),
    category: varchar("category", { length: 100 }),
    country: varchar("country", { length: 10 }),
    language: varchar("language", { length: 10 }),
    sourcePlatforms: text("source_platforms").array(),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
    lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),
    verificationStatus: verificationStatusEnum("verification_status").notNull().default("unverified"),
    evidenceLevel: evidenceLevelEnum("evidence_level").notNull().default("low"),
    summary: text("summary"),
    thumbnailUrl: text("thumbnail_url"),
    searchFallbackUrl: text("search_fallback_url"),

    // Scores
    momentumScore: decimal("momentum_score", { precision: 7, scale: 4 }),
    confidenceScore: decimal("confidence_score", { precision: 7, scale: 4 }),
    crossPlatformScore: decimal("cross_platform_score", { precision: 7, scale: 4 }),
    commercialRelevanceScore: decimal("commercial_relevance_score", { precision: 7, scale: 4 }),
    freshnessScore: decimal("freshness_score", { precision: 7, scale: 4 }),
    scoreExplanations: jsonb("score_explanations"),

    // AI-generated insights
    whyRising: text("why_rising"),
    whoCares: text("who_cares"),
    commercialAngle: text("commercial_angle"),
    brandAngle: text("brand_angle"),
    ecommerceAngle: text("ecommerce_angle"),
    contentAngle: text("content_angle"),
    risks: text("risks"),
    recommendedActions: text("recommended_actions").array(),
    businessUseCases: text("business_use_cases").array(),
    rawSignals: jsonb("raw_signals"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    idx_canonical_trends_category_country: index("idx_canonical_trends_category_country").on(table.category, table.country),
    idx_canonical_trends_momentum: index("idx_canonical_trends_momentum").on(table.momentumScore),
  }),
);

export const trendSources = pgTable("trend_sources", {
  id: uuid("id").primaryKey().defaultRandom(),
  trendId: uuid("trend_id")
    .notNull()
    .references(() => canonicalTrends.id, { onDelete: "cascade" }),
  platform: varchar("platform", { length: 100 }).notNull(),
  url: text("url"),
  title: text("title"),
  metrics: jsonb("metrics"),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  isAccessible: boolean("is_accessible"),
  searchFallbackUrl: text("search_fallback_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const trendVerifications = pgTable("trend_verifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  trendId: uuid("trend_id")
    .notNull()
    .references(() => canonicalTrends.id, { onDelete: "cascade" }),
  verifiedBy: text("verified_by").notNull(),
  status: verificationStatusEnum("status").notNull(),
  evidence: jsonb("evidence"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const trendReports = pgTable("trend_reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  trendId: uuid("trend_id")
    .notNull()
    .references(() => canonicalTrends.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  reportType: trendReportTypeEnum("report_type").notNull(),
  contentMarkdown: text("content_markdown"),
  dataLayers: jsonb("data_layers"),
  modelUsed: varchar("model_used", { length: 100 }),
  cost: decimal("cost", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const dailyReports = pgTable("daily_reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  platformGroup: varchar("platform_group", { length: 100 }),
  category: varchar("category", { length: 100 }),
  country: varchar("country", { length: 10 }),
  contentMarkdown: text("content_markdown"),
  trendCount: integer("trend_count").default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const connectorRuns = pgTable("connector_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  queryId: uuid("query_id")
    .notNull()
    .references(() => trendQueries.id, { onDelete: "cascade" }),
  connectorId: varchar("connector_id", { length: 100 }).notNull(),
  status: connectorRunStatusEnum("status").notNull().default("pending"),
  hitsCount: integer("hits_count").default(0),
  durationMs: integer("duration_ms"),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const cacheEntries = pgTable(
  "cache_entries",
  {
    key: text("key").primaryKey(),
    level: cacheLevelEnum("level").notNull(),
    data: jsonb("data").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    hitCount: integer("hit_count").notNull().default(0),
  },
  (table) => ({
    idx_cache_entries_expires_at: index("idx_cache_entries_expires_at").on(table.expiresAt),
  }),
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id"),
    action: varchar("action", { length: 100 }).notNull(),
    resourceType: varchar("resource_type", { length: 100 }),
    resourceId: varchar("resource_id", { length: 255 }),
    details: jsonb("details"),
    ipAddress: varchar("ip_address", { length: 45 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    idx_audit_logs_user_created: index("idx_audit_logs_user_created").on(table.userId, table.createdAt),
  }),
);
