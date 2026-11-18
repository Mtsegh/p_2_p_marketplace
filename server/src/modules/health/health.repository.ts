import { prisma } from "../../db/prisma.js";
import { ensureRedisConnected, redis } from "../../db/redis.js";

/** Readiness probes. Only this layer talks to the database and cache. */

export async function pingDatabase(): Promise<void> {
  await prisma.$queryRaw`SELECT 1`;
}

export async function pingRedis(): Promise<void> {
  await ensureRedisConnected();

  const response = await redis.ping();

  if (response !== "PONG") {
    throw new Error(`Unexpected Redis PING response: ${response}`);
  }
}
