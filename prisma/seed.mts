import { prisma } from "../server/src/db/prisma.js";
import { logger } from "../server/src/lib/logger.js";
import { hashPassword } from "../server/src/modules/auth/password.js";

/**
 * Development seed. Creates (or resets) the administrator account so the
 * admin-only routes can be exercised locally. Running it against production
 * requires an explicit password; there is no default that could ship.
 */
const isProduction = process.env.NODE_ENV === "production";

const email = (process.env.SEED_ADMIN_EMAIL ?? "admin@example.com")
  .trim()
  .toLowerCase();
const password = process.env.SEED_ADMIN_PASSWORD;

if (isProduction && !password) {
  throw new Error(
    "SEED_ADMIN_PASSWORD is required when seeding with NODE_ENV=production",
  );
}

const resolvedPassword = password ?? "dev-admin-password";

if (resolvedPassword.length < 10) {
  throw new Error("The seed admin password must be at least 10 characters");
}

const passwordHash = await hashPassword(resolvedPassword);

const admin = await prisma.user.upsert({
  where: { email },
  update: {
    passwordHash,
    role: "ADMIN",
    status: "ACTIVE",
    emailVerifiedAt: new Date(),
  },
  create: {
    email,
    passwordHash,
    role: "ADMIN",
    emailVerifiedAt: new Date(),
  },
});

logger.info(
  { email: admin.email, role: admin.role },
  "seed complete: admin account ready",
);

await prisma.$disconnect();
