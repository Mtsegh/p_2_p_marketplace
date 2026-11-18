import { createHash } from "node:crypto";
import type { Request, RequestHandler } from "express";
import { ensureRedisConnected, redis } from "../db/redis.js";
import { AppError, isAppError } from "./app-error.js";
import { logger } from "./logger.js";

/**
 * Fixed-window counter. INCR and EXPIRE run in one Lua call so a burst cannot
 * leave a key without a TTL. Windows are intentionally coarse: their job is to
 * stop brute force and scripted signups, not to meter normal use.
 */
const WINDOW_SCRIPT = `
local current = redis.call("INCR", KEYS[1])
if current == 1 then
  redis.call("EXPIRE", KEYS[1], ARGV[1])
end
return current
`;

export interface RateLimitOptions {
  /** Namespace for Redis keys, e.g. "login-ip". */
  name: string;
  limit: number;
  windowSeconds: number;
  /** Returns the identity being limited, e.g. an IP or a hashed email. */
  key: (req: Request) => string;
}

/** Request IP, falling back to a single bucket when Express cannot tell. */
export function ipKey(req: Request): string {
  return req.ip ?? "unknown";
}

/**
 * Hashes an email before using it in a limiter key. Keeps PII out of Redis and
 * avoids leaking an address to anyone with cache access.
 */
export function emailKey(req: Request): string {
  const email =
    typeof req.body === "object" && req.body !== null
      ? (req.body as { email?: unknown }).email
      : undefined;

  if (typeof email !== "string" || email.length === 0) {
    return "missing";
  }

  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

export function rateLimit(options: RateLimitOptions): RequestHandler {
  return async (req, res, next) => {
    const key = `ratelimit:${options.name}:${options.key(req)}`;

    try {
      await ensureRedisConnected();

      const count = (await redis.eval(
        WINDOW_SCRIPT,
        1,
        key,
        options.windowSeconds,
      )) as number;

      if (count > options.limit) {
        const ttl = await redis.ttl(key);

        if (ttl > 0) {
          res.setHeader("Retry-After", String(ttl));
        }

        next(
          new AppError(
            "RATE_LIMITED",
            429,
            "Too many attempts. Try again later.",
          ),
        );
        return;
      }

      next();
    } catch (error) {
      if (isAppError(error)) {
        next(error);
        return;
      }

      // Redis is a dependency of the limiter, not of authentication. Failing
      // open keeps sign-in usable during a cache outage; the event is logged
      // so the outage is still visible.
      logger.warn(
        { err: error, limiter: options.name },
        "rate limiter unavailable, allowing request",
      );
      next();
    }
  };
}
