import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import { config } from "./config/index.js";
import { logger } from "./config/logger.js";
import { authMiddleware } from "./middleware/auth.js";
import { rateLimitMiddleware } from "./middleware/rateLimit.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { healthCheck, closeDatabase } from "./db/index.js";

const app = express();

// ---------------------------------------------------------------------------
// Global middleware
// ---------------------------------------------------------------------------

app.use(helmet());

// CORS – allow configured origins in production, open in development
const allowedOrigins = process.env["CORS_ORIGINS"]
  ?.split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors(
    allowedOrigins && allowedOrigins.length > 0
      ? {
          origin: allowedOrigins,
          credentials: true,
        }
      : undefined,
  ),
);

app.use(compression());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

// Attach user from Firebase token (optional - does not reject unauthenticated)
app.use(authMiddleware);

// Rate limiting
app.use(rateLimitMiddleware);

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

app.get("/health", async (_req, res) => {
  const dbOk = await healthCheck();
  const status = dbOk ? "healthy" : "degraded";
  const statusCode = dbOk ? 200 : 503;
  res.status(statusCode).json({
    status,
    timestamp: new Date().toISOString(),
    version: process.env["npm_package_version"] ?? "0.1.0",
    database: dbOk ? "connected" : "disconnected",
  });
});

// ---------------------------------------------------------------------------
// API routes
// ---------------------------------------------------------------------------

import authRouter from "./modules/auth/router.js";
import discoveryRouter from "./modules/discovery/router.js";
import creditRouter from "./modules/credit/router.js";
import reportRouter from "./modules/report/router.js";
import healthRouter from "./modules/health/router.js";
import adminRouter from "./modules/admin/router.js";

app.use("/api/auth", authRouter);
app.use("/api/trends", discoveryRouter);
app.use("/api/credits", creditRouter);
app.use("/api/reports", reportRouter);
app.use("/api/health", healthRouter);
app.use("/api/admin", adminRouter);

// ---------------------------------------------------------------------------
// Fallback & error handling
// ---------------------------------------------------------------------------

app.use(notFoundHandler);
app.use(errorHandler);

// ---------------------------------------------------------------------------
// Server startup
// ---------------------------------------------------------------------------

const server = app.listen(config.port, () => {
  logger.info(`TrendMetrics backend started`, {
    port: config.port,
    env: config.nodeEnv,
  });
});

// Graceful shutdown
function gracefulShutdown(signal: string): void {
  logger.info(`Received ${signal}, shutting down gracefully`);
  server.close(async () => {
    logger.info("HTTP server closed");
    await closeDatabase();
    logger.info("Database connections closed");
    process.exit(0);
  });

  // Force exit after 10 seconds
  setTimeout(() => {
    logger.error("Forced shutdown after timeout");
    process.exit(1);
  }, 10_000).unref();
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled rejection", { reason });
});

process.on("uncaughtException", (err) => {
  logger.error("Uncaught exception", { error: err.message, stack: err.stack });
  process.exit(1);
});

export { app };
