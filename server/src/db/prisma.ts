import { PrismaPg } from "@prisma/adapter-pg";
import { env } from "../config/env.js";
import { PrismaClient } from "../generated/prisma/client.js";

/**
 * Prisma 7 requires a driver adapter. Timeouts mirror the old Rust engine
 * defaults closely enough for a request-scoped API.
 */
const adapter = new PrismaPg({
  connectionString: env.DATABASE_URL,
  max: 10,
  connectionTimeoutMillis: 5_000,
  idleTimeoutMillis: 30_000,
});

export const prisma = new PrismaClient({ adapter });
