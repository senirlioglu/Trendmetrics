'use strict';

import { eq, lt } from 'drizzle-orm';
import type { CacheLevel } from '@trendmetrics/shared';
import { db } from '../../db/index.js';
import { cacheEntries } from '../../db/schema.js';
import { config } from '../../config/index.js';
import { createChildLogger } from '../../config/logger.js';
import crypto from 'crypto';

const logger = createChildLogger({ module: 'cache-service' });

// ---------------------------------------------------------------------------
// CacheService
// ---------------------------------------------------------------------------

export class CacheService {
  private readonly ttls: Record<CacheLevel, number>;

  constructor() {
    this.ttls = {
      hot: config.cache.hotTtlMinutes * 60 * 1000,
      daily: config.cache.dailyTtlHours * 60 * 60 * 1000,
      history: config.cache.historyTtlDays * 24 * 60 * 60 * 1000,
    };
  }

  /**
   * Get a cached entry by key. Returns null if not found or expired.
   */
  async get<T>(key: string): Promise<{ data: T; level: CacheLevel } | null> {
    try {
      const result = await db
        .select()
        .from(cacheEntries)
        .where(eq(cacheEntries.key, key))
        .limit(1);

      if (result.length === 0) return null;

      const entry = result[0]!;
      const now = new Date();

      // Check expiry
      if (entry.expiresAt && new Date(entry.expiresAt) < now) {
        await this.invalidate(key);
        return null;
      }

      // Increment hit count (fire-and-forget)
      db.update(cacheEntries)
        .set({ hitCount: (entry.hitCount ?? 0) + 1 })
        .where(eq(cacheEntries.key, key))
        .then(() => {})
        .catch((err: unknown) => {
          logger.debug('Failed to update cache hit count', {
            key,
            error: err instanceof Error ? err.message : String(err),
          });
        });

      logger.debug('Cache hit', { key, level: entry.level });

      return {
        data: entry.data as T,
        level: entry.level as CacheLevel,
      };
    } catch (err: unknown) {
      logger.warn('Cache get error', {
        key,
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }

  /**
   * Set a cache entry. Upserts on key conflict.
   */
  async set(key: string, data: unknown, level: CacheLevel): Promise<void> {
    try {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + this.ttls[level]);
      const serializedData = JSON.parse(JSON.stringify(data));

      await db
        .insert(cacheEntries)
        .values({
          key,
          level,
          data: serializedData,
          createdAt: now,
          expiresAt,
          hitCount: 0,
        })
        .onConflictDoUpdate({
          target: cacheEntries.key,
          set: {
            data: serializedData,
            level,
            createdAt: now,
            expiresAt,
            hitCount: 0,
          },
        });

      logger.debug('Cache set', { key, level, expiresAt: expiresAt.toISOString() });
    } catch (err: unknown) {
      logger.warn('Cache set error', {
        key,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * Invalidate (delete) a cache entry by key.
   */
  async invalidate(key: string): Promise<void> {
    try {
      await db.delete(cacheEntries).where(eq(cacheEntries.key, key));
      logger.debug('Cache invalidated', { key });
    } catch (err: unknown) {
      logger.warn('Cache invalidate error', {
        key,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * Clean up all expired cache entries.
   */
  async cleanup(): Promise<number> {
    try {
      const now = new Date();
      const result = await db
        .delete(cacheEntries)
        .where(lt(cacheEntries.expiresAt, now))
        .returning();

      const count = result.length;
      if (count > 0) {
        logger.info('Cache cleanup completed', { removedEntries: count });
      }
      return count;
    } catch (err: unknown) {
      logger.error('Cache cleanup error', {
        error: err instanceof Error ? err.message : String(err),
      });
      return 0;
    }
  }

  /**
   * Build a deterministic cache key from level, resource name, and params.
   * Format: {level}:{resource}:{params_hash}
   */
  static buildKey(level: CacheLevel, resource: string, params: Record<string, string>): string {
    const sorted = Object.entries(params).sort(([a], [b]) => a.localeCompare(b));
    const hash = crypto
      .createHash('sha256')
      .update(JSON.stringify(sorted))
      .digest('hex')
      .substring(0, 12);
    return `${level}:${resource}:${hash}`;
  }
}
