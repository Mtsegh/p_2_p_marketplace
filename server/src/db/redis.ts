import { Redis } from "ioredis";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";

/**
 * Shared Redis connection. Lazy so importing the app never opens a socket in
 * tests or scripts that do not need Redis. Offline queueing is disabled so a
 * readiness check fails fast instead of hanging.
 */
export const redis = new Redis(env.REDIS_URL, {
  lazyConnect: true,
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
  connectTimeout: 3_000,
  commandTimeout: 2_000,
});

redis.on("error", (error) => {
  logger.warn({ err: error }, "redis connection error");
});

/**
 * Ensures the lazy connection is ready before issuing a command. Without this,
 * the first command after boot can race the connection and make readiness
 * report a false outage.
 */
export async function ensureRedisConnected(): Promise<void> {
  if (redis.status === "ready") {
    return;
  }

  if (redis.status === "wait" || redis.status === "end") {
    await redis.connect();
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Timed out waiting for Redis connection"));
    }, 3_000);

    const cleanup = (): void => {
      clearTimeout(timeout);
      redis.off("ready", onReady);
      redis.off("error", onError);
    };
    const onReady = (): void => {
      cleanup();
      resolve();
    };
    const onError = (error: Error): void => {
      cleanup();
      reject(error);
    };

    redis.once("ready", onReady);
    redis.once("error", onError);
  });
}

export async function closeRedis(): Promise<void> {
  if (redis.status === "end") {
    return;
  }

  try {
    await redis.quit();
  } catch {
    redis.disconnect();
  }
}
