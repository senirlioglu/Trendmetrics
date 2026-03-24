import { z } from "zod";

// ---------------------------------------------------------------------------
// Reusable enum schemas
// ---------------------------------------------------------------------------

const platformGroupSchema = z.enum([
  "social-media",
  "e-commerce",
  "app-stores",
  "travel-local",
  "search-engines",
]);

// ---------------------------------------------------------------------------
// POST /api/trends/discover
// ---------------------------------------------------------------------------

export const discoverRequestSchema = z.object({
  platform_group: platformGroupSchema,
  category: z.string().min(1).max(100),
  country: z
    .string()
    .min(2)
    .max(10)
    .transform((v) => v.toUpperCase()),
  language: z.string().min(2).max(10).default("en"),
  seed_query: z.string().max(500).optional(),
  force_refresh: z.boolean().optional().default(false),
});

export type DiscoverRequestInput = z.infer<typeof discoverRequestSchema>;

// ---------------------------------------------------------------------------
// POST /api/trends/:id/deep-analysis
// ---------------------------------------------------------------------------

export const deepAnalysisRequestSchema = z.object({
  // Body is intentionally lean; trend id comes from the route param.
  // The idempotency key is read from a header, not from the body.
});

export type DeepAnalysisRequestInput = z.infer<typeof deepAnalysisRequestSchema>;

// ---------------------------------------------------------------------------
// POST /api/credits/topup
// ---------------------------------------------------------------------------

export const topUpRequestSchema = z.object({
  amount: z.number().positive().max(10_000),
  payment_token: z.string().min(1).max(500),
});

export type TopUpRequestInput = z.infer<typeof topUpRequestSchema>;

// ---------------------------------------------------------------------------
// POST /api/reports/daily
// ---------------------------------------------------------------------------

export const dailyReportRequestSchema = z.object({
  platform_group: platformGroupSchema,
  category: z.string().min(1).max(100),
  country: z
    .string()
    .min(2)
    .max(10)
    .transform((v) => v.toUpperCase()),
});

export type DailyReportRequestInput = z.infer<typeof dailyReportRequestSchema>;

// ---------------------------------------------------------------------------
// POST /api/auth/session
// ---------------------------------------------------------------------------

export const sessionRequestSchema = z.object({
  firebase_token: z.string().min(1),
});

export type SessionRequestInput = z.infer<typeof sessionRequestSchema>;

// ---------------------------------------------------------------------------
// Pagination helper
// ---------------------------------------------------------------------------

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export type PaginationInput = z.infer<typeof paginationSchema>;

// ---------------------------------------------------------------------------
// Report history query
// ---------------------------------------------------------------------------

export const reportHistoryQuerySchema = paginationSchema.extend({
  type: z.enum(["deep_analysis", "comparison"]).optional(),
});

export type ReportHistoryQueryInput = z.infer<typeof reportHistoryQuerySchema>;
