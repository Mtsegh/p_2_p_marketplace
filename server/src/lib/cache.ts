import { ensureRedisConnected, redis } from "../db/redis.js";
import { logger } from "./logger.js";

/**
 * Thin read-through cache for hot, read-heavy data. Cache failures never break
 * the request: they are logged and the value is loaded from the database. All
 * entries are JSON so callers get their original shape back.
 */
export async function cached<T>(
  key: string,
  ttlSeconds: number,
  load: () => Promise<T>,
): Promise<T> {
  const cacheKey = `cache:${key}`;

  try {
    await ensureRedisConnected();
    const raw = await redis.get(cacheKey);

    if (raw !== null) {
      return JSON.parse(raw) as T;
    }
  } catch (error) {
    logger.warn({ err: error, key: cacheKey }, "cache read failed");
  }

  const value = await load();

  try {
    await redis.set(cacheKey, JSON.stringify(value), "EX", ttlSeconds);
  } catch (error) {
    logger.warn({ err: error, key: cacheKey }, "cache write failed");
  }

  return value;
}

/** Removes one or more cache entries. Safe to call when Redis is unavailable. */
export async function invalidateCache(...keys: string[]): Promise<void> {
  if (keys.length === 0) {
    return;
  }

  try {
    await ensureRedisConnected();
    await redis.del(...keys.map((key) => `cache:${key}`));
  } catch (error) {
    logger.warn({ err: error, keys }, "cache invalidation failed");
  }
}
