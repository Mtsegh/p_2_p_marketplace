import { ensureRedisConnected, redis } from "../../db/redis.js";
import { logger } from "../../lib/logger.js";
import { accessTokenTtlSeconds } from "./tokens.js";

/**
 * Access tokens are stateless, so logging out cannot delete them. Instead the
 * session they were issued for is denied in Redis for the token's remaining
 * lifetime. Entries expire on their own; nothing needs cleanup.
 *
 * Failures fail open: the refresh session is still revoked, so the outage
 * cannot produce a persistent login. The alternative, failing closed, would
 * sign every user out during a Redis blip.
 */
const KEY_PREFIX = "auth:revoked-session:";

export async function denySession(sessionId: string): Promise<void> {
  try {
    await ensureRedisConnected();
    await redis.set(
      `${KEY_PREFIX}${sessionId}`,
      "1",
      "EX",
      accessTokenTtlSeconds,
    );
  } catch (error) {
    logger.warn(
      { err: error },
      "could not add session to the access-token denylist",
    );
  }
}

export async function isSessionDenied(sessionId: string): Promise<boolean> {
  try {
    await ensureRedisConnected();
    return (await redis.exists(`${KEY_PREFIX}${sessionId}`)) === 1;
  } catch (error) {
    logger.warn({ err: error }, "could not check the access-token denylist");
    return false;
  }
}
