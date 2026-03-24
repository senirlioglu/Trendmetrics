import dotenv from "dotenv";

dotenv.config();

function optionalEnv(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

function intEnv(key: string, fallback: number): number {
  const raw = process.env[key];
  if (!raw) return fallback;
  const parsed = parseInt(raw, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`Environment variable ${key} must be a valid integer, got: ${raw}`);
  }
  return parsed;
}

function floatEnv(key: string, fallback: number): number {
  const raw = process.env[key];
  if (!raw) return fallback;
  const parsed = parseFloat(raw);
  if (Number.isNaN(parsed)) {
    throw new Error(`Environment variable ${key} must be a valid number, got: ${raw}`);
  }
  return parsed;
}

export const config = {
  port: intEnv("PORT", 4000),
  nodeEnv: optionalEnv("NODE_ENV", "development"),

  database: {
    url: optionalEnv("DATABASE_URL", "postgresql://trendmetrics:trendmetrics@localhost:5432/trendmetrics"),
    poolMin: intEnv("DATABASE_POOL_MIN", 2),
    poolMax: intEnv("DATABASE_POOL_MAX", 10),
  },

  firebase: {
    projectId: optionalEnv("FIREBASE_PROJECT_ID", ""),
    clientEmail: optionalEnv("FIREBASE_CLIENT_EMAIL", ""),
    privateKey: optionalEnv("FIREBASE_PRIVATE_KEY", "").replace(/\\n/g, "\n"),
  },

  gemini: {
    apiKey: optionalEnv("GEMINI_API_KEY", ""),
    defaultModel: optionalEnv("GEMINI_DEFAULT_MODEL", "gemini-2.0-flash"),
    fallbackModel: optionalEnv("GEMINI_FALLBACK_MODEL", "gemini-1.5-flash"),
  },

  cache: {
    hotTtlMinutes: intEnv("CACHE_HOT_TTL_MINUTES", 15),
    dailyTtlHours: intEnv("CACHE_DAILY_TTL_HOURS", 24),
    historyTtlDays: intEnv("CACHE_HISTORY_TTL_DAYS", 7),
  },

  credits: {
    deepAnalysisCost: floatEnv("CREDITS_DEEP_ANALYSIS_COST", 3.0),
    forceRefreshCost: floatEnv("CREDITS_FORCE_REFRESH_COST", 1.0),
    dailyReportCost: floatEnv("CREDITS_DAILY_REPORT_COST", 2.0),
    signupBonus: floatEnv("CREDITS_SIGNUP_BONUS", 10.0),
  },

  rateLimit: {
    windowMs: intEnv("RATE_LIMIT_WINDOW_MS", 60_000),
    maxRequests: intEnv("RATE_LIMIT_MAX_REQUESTS", 30),
  },

  queue: {
    redisUrl: process.env["REDIS_URL"] ?? null,
  },
} as const;

export type Config = typeof config;
