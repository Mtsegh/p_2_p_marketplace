/**
 * Test-data helper for the Playwright suite. Runs inside the server workspace
 * so it can use the server's own Prisma client, Redis connection and password
 * hasher. No authentication backdoor is added to the API: users are seeded
 * directly in the test database, exactly like the Vitest helpers do.
 *
 * Usage (from server/, with TEST_DATABASE_URL pointing at the test DB):
 *   npx tsx e2e/seed.mts reset
 *   npx tsx e2e/seed.mts create-user <email> <password> <verified> <onboarded> <admin>
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { ensureRedisConnected, redis } from "../src/db/redis.js";
import { hashPassword } from "../src/modules/auth/password.js";

const connectionString =
  process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("TEST_DATABASE_URL is required for the E2E seed helper");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString, max: 5 }),
});

async function main(): Promise<void> {
  const [operation, email, password, verified, onboarded, admin] =
    process.argv.slice(2);

  if (operation === "reset") {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "reports", "reviews", "platform_settings", "dispute_evidence", "disputes", "notification_events", "ledger_entries", "webhook_events", "transactions", "deal_messages", "deal_offered_listings", "deal_history", "deals", "auth_tokens", "sessions", "users", "listings", "listing_images", "categories" RESTART IDENTITY CASCADE',
    );
    await ensureRedisConnected();
    await redis.flushdb();
    console.log("ok");
    return;
  }

  if (operation === "create-user") {
    if (!email || !password) {
      throw new Error("create-user requires <email> <password>");
    }

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: await hashPassword(password),
        role: admin === "true" ? "ADMIN" : "USER",
        emailVerifiedAt: verified === "true" ? new Date() : null,
        payoutOnboardedAt: onboarded === "true" ? new Date() : null,
        payoutAccountId: onboarded === "true" ? `e2e_acct_${email}` : null,
        profile: {
          create: { displayName: email.split("@")[0] ?? "E2E member" },
        },
      },
      select: { id: true },
    });

    console.log(JSON.stringify({ id: user.id }));
    return;
  }

  throw new Error(`Unknown seed operation: ${operation}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (redis.status === "ready") {
      await redis.quit().catch(() => undefined);
    } else {
      redis.disconnect();
    }
    await prisma.$disconnect();
  });
