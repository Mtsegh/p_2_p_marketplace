import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { prisma } from "../src/db/prisma.js";
import {
  lastEmailTo,
  registerUser,
  resetIdentityState,
  tokenFromEmail,
} from "./helpers.js";

const app = createApp();

beforeEach(async () => {
  await resetIdentityState();
});

async function requestReset(email: string) {
  return request(app)
    .post("/api/v1/auth/password/forgot")
    .send({ email })
    .expect(202);
}

describe("POST /api/v1/auth/password/forgot", () => {
  it("answers the same for an address with no account", async () => {
    const response = await request(app)
      .post("/api/v1/auth/password/forgot")
      .send({ email: "nobody@example.com" })
      .expect(202);

    expect(response.body.data.status).toBe("accepted");
    expect(lastEmailTo("nobody@example.com")).toBeUndefined();
  });

  it("emails a reset link for an existing account", async () => {
    const user = await registerUser(app);

    await requestReset(user.email);

    const email = lastEmailTo(user.email);

    expect(email?.subject).toBe("Reset your password");
    expect(email?.text).toContain("/reset-password?token=");
    expect(email?.text).toContain("60 minutes");
  });

  it("ignores a suspended account without saying so", async () => {
    const user = await registerUser(app);

    await prisma.user.update({
      where: { id: user.id },
      data: { status: "SUSPENDED" },
    });

    await requestReset(user.email);

    expect(lastEmailTo(user.email)?.subject).not.toBe("Reset your password");
  });

  it("limits requests per address", async () => {
    const user = await registerUser(app);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await requestReset(user.email);
    }

    const response = await request(app)
      .post("/api/v1/auth/password/forgot")
      .send({ email: user.email })
      .expect(429);

    expect(response.body.error.code).toBe("RATE_LIMITED");
  });
});

describe("POST /api/v1/auth/password/reset", () => {
  it("changes the password, revokes sessions, and invalidates the link", async () => {
    const user = await registerUser(app);

    await requestReset(user.email);
    const token = tokenFromEmail(lastEmailTo(user.email)!);

    await request(app)
      .post("/api/v1/auth/password/reset")
      .send({ token, password: "a-brand-new-password" })
      .expect(204);

    await request(app)
      .post("/api/v1/auth/login")
      .send({ email: user.email, password: user.password })
      .expect(401);

    const login = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: user.email, password: "a-brand-new-password" })
      .expect(200);

    expect(login.body.data.user.id).toBe(user.id);

    // The device that was signed in before the reset is signed out too.
    await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", user.cookie!)
      .expect(401);

    // Single use: the same link cannot be replayed.
    await request(app)
      .post("/api/v1/auth/password/reset")
      .send({ token, password: "yet-another-password" })
      .expect(400);
  });

  it("rejects an expired or unknown token", async () => {
    const user = await registerUser(app);

    await requestReset(user.email);
    const token = tokenFromEmail(lastEmailTo(user.email)!);

    await prisma.authToken.updateMany({
      where: { userId: user.id, type: "PASSWORD_RESET" },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });

    const expired = await request(app)
      .post("/api/v1/auth/password/reset")
      .send({ token, password: "a-brand-new-password" })
      .expect(400);

    expect(expired.body.error.code).toBe("INVALID_TOKEN");

    const unknown = await request(app)
      .post("/api/v1/auth/password/reset")
      .send({ token: "z".repeat(43), password: "a-brand-new-password" })
      .expect(400);

    expect(unknown.body.error.code).toBe("INVALID_TOKEN");
  });

  it("validates the new password before touching the token", async () => {
    const user = await registerUser(app);

    await requestReset(user.email);
    const token = tokenFromEmail(lastEmailTo(user.email)!);

    const response = await request(app)
      .post("/api/v1/auth/password/reset")
      .send({ token, password: "short" })
      .expect(422);

    expect(response.body.error.details[0].field).toBe("password");
  });

  it("counts as a public write and refuses another origin", async () => {
    await request(app)
      .post("/api/v1/auth/password/forgot")
      .set("Origin", "https://evil.example")
      .send({ email: "someone@example.com" })
      .expect(403);
  });
});
