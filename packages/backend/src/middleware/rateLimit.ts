import type { Request, Response, NextFunction } from "express";
import { config } from "../config/index.js";
import { AppError } from "./errorHandler.js";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Periodically clean up expired entries to prevent memory leaks
const CLEANUP_INTERVAL_MS = 60_000;
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now >= entry.resetAt) {
      store.delete(key);
    }
  }
}, CLEANUP_INTERVAL_MS).unref();

function getClientKey(req: Request): string {
  // Prefer authenticated user ID, fall back to IP
  if (req.user?.uid) {
    return `user:${req.user.uid}`;
  }
  const forwarded = req.headers["x-forwarded-for"];
  const ip = typeof forwarded === "string"
    ? forwarded.split(",")[0]?.trim()
    : req.ip ?? req.socket.remoteAddress ?? "unknown";
  return `ip:${ip}`;
}

export function rateLimitMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const { windowMs, maxRequests } = config.rateLimit;
  const key = getClientKey(req);
  const now = Date.now();

  let entry = store.get(key);

  if (!entry || now >= entry.resetAt) {
    entry = { count: 0, resetAt: now + windowMs };
    store.set(key, entry);
  }

  entry.count++;

  // Set rate limit headers
  const remaining = Math.max(0, maxRequests - entry.count);
  const resetSeconds = Math.ceil((entry.resetAt - now) / 1000);

  res.setHeader("X-RateLimit-Limit", String(maxRequests));
  res.setHeader("X-RateLimit-Remaining", String(remaining));
  res.setHeader("X-RateLimit-Reset", String(resetSeconds));

  if (entry.count > maxRequests) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    res.setHeader("Retry-After", String(retryAfter));
    next(
      new AppError(
        429,
        "RATE_LIMIT_EXCEEDED",
        `Too many requests. Try again in ${retryAfter} seconds.`,
      ),
    );
    return;
  }

  next();
}
