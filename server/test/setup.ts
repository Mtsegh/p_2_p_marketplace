import "dotenv/config";
import { afterAll } from "vitest";

/**
 * Runs before each test module, so these values are in place before the app's
 * env module is imported. No `.env` file is required: every variable the app
 * needs has a local default here.
 */
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";
process.env.CLIENT_URL ??= "http://localhost:3000";
process.env.PORT ??= "4000";
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://marketplace:marketplace@localhost:5432/marketplace_test";
process.env.REDIS_URL ??= "redis://localhost:6379/1";

afterAll(async () => {
  const { prisma } = await import("../src/db/prisma.js");
  const { closeRedis } = await import("../src/db/redis.js");

  await prisma.$disconnect();
  await closeRedis();
});
