import { randomUUID } from "node:crypto";
import request from "supertest";
import { prisma } from "../src/db/prisma.js";
import { ensureRedisConnected, redis } from "../src/db/redis.js";
import {
  clearOutbox,
  readOutbox,
  type CapturedEmail,
} from "../src/modules/email/memory.provider.js";
import {
  clearOutbox as clearSmsOutbox,
  readOutbox as readSmsOutbox,
  type CapturedSms,
} from "../src/modules/sms/memory.provider.js";
import { clearStorage } from "../src/modules/storage/memory.provider.js";
import { hashPassword } from "../src/modules/auth/password.js";

export { clearSmsOutbox, readSmsOutbox };

/**
 * Tests share one database, so each test starts from an empty identity slice
 * and an empty Redis (rate-limit counters and the session denylist included).
 * The email outbox is cleared for the same reason.
 */
export async function resetIdentityState(): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "reports", "reviews", "platform_settings", "dispute_evidence", "disputes", "notification_events", "ledger_entries", "webhook_events", "transactions", "deal_messages", "deal_offered_listings", "deal_history", "deals", "auth_tokens", "sessions", "users", "listings", "listing_images", "categories" RESTART IDENTITY CASCADE',
  );
  await ensureRedisConnected();
  await redis.flushdb();
  clearOutbox();
  clearSmsOutbox();
  clearStorage();
}

export function setCookies(response: request.Response): string[] {
  const header = response.headers["set-cookie"] as unknown;

  if (Array.isArray(header)) {
    return header as string[];
  }

  return typeof header === "string" ? [header] : [];
}

export function refreshCookie(response: request.Response): string | undefined {
  return setCookies(response)
    .find((cookie) => cookie.startsWith("marketplace_refresh="))
    ?.split(";")[0];
}

/** Most recent email sent to an address, or undefined if none was sent. */
export function lastEmailTo(email: string): CapturedEmail | undefined {
  return [...readOutbox()].reverse().find((message) => message.to === email);
}

/**
 * Pulls the action token out of the emailed link. The tests follow the link
 * the way a person would, instead of reading the database.
 */
export function tokenFromEmail(message: CapturedEmail): string {
  const match = message.text.match(/[?&]token=([A-Za-z0-9_-]+)/);

  if (!match) {
    throw new Error(`No token found in the email "${message.subject}"`);
  }

  return match[1];
}

/** Most recent SMS sent to a phone number, or undefined if none was sent. */
export function lastSmsTo(phone: string): CapturedSms | undefined {
  return [...readSmsOutbox()].reverse().find((message) => message.to === phone);
}

/** Pulls the 6-digit verification code out of the last SMS to a phone. */
export function codeFromSms(message: CapturedSms): string {
  const match = message.body.match(/\b(\d{6})\b/);

  if (!match) {
    throw new Error(`No verification code found in the SMS "${message.body}"`);
  }

  return match[1];
}

export interface TestUser {
  email: string;
  password: string;
  id: string;
  accessToken: string;
  cookie: string | undefined;
}

export async function registerUser(
  app: import("express").Express,
  overrides: { email?: string; password?: string } = {},
): Promise<TestUser> {
  const email = overrides.email ?? `user-${randomUUID()}@example.com`;
  const password = overrides.password ?? "correct-horse-battery";

  const response = await request(app)
    .post("/api/v1/auth/register")
    .send({ email, password })
    .expect(201);

  return {
    email: response.body.data.user.email as string,
    password,
    id: response.body.data.user.id as string,
    accessToken: response.body.data.accessToken as string,
    cookie: refreshCookie(response),
  };
}

export async function createAdmin(
  app: import("express").Express,
  email = `admin-${randomUUID()}@example.com`,
): Promise<TestUser> {
  const password = "admin-password-123";

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: await hashPassword(password),
      role: "ADMIN",
      emailVerifiedAt: new Date(),
      profile: { create: {} },
    },
  });

  const response = await request(app)
    .post("/api/v1/auth/login")
    .send({ email, password })
    .expect(200);

  return {
    email,
    password,
    id: user.id,
    accessToken: response.body.data.accessToken as string,
    cookie: refreshCookie(response),
  };
}
