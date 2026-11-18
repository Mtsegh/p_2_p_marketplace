import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { prisma } from "../src/db/prisma.js";
import {
  lastEmailTo,
  refreshCookie,
  registerUser,
  resetIdentityState,
  tokenFromEmail,
} from "./helpers.js";

const app = createApp();

beforeEach(async () => {
  await resetIdentityState();
});

describe("registration email", () => {
  it("sends a confirmation link to the new address", async () => {
    const user = await registerUser(app);
    const email = lastEmailTo(user.email);

    expect(email?.subject).toBe("Confirm your email address");
    expect(email?.text).toContain("/verify-email?token=");
    expect(email?.html).toContain("/verify-email?token=");
    expect(email?.html).toContain("Confirm email address");

    const me = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .expect(200);

    expect(me.body.data.user.emailVerified).toBe(false);
  });

  it("stores only a hash of the token", async () => {
    const user = await registerUser(app);
    const token = tokenFromEmail(lastEmailTo(user.email)!);
    const rows = await prisma.authToken.findMany({
      where: { userId: user.id, type: "EMAIL_VERIFY" },
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].tokenHash).not.toBe(token);
    expect(rows[0].tokenHash).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("POST /api/v1/auth/verify-email", () => {
  it("confirms the address and is reflected in /auth/me", async () => {
    const user = await registerUser(app);
    const token = tokenFromEmail(lastEmailTo(user.email)!);

    const response = await request(app)
      .post("/api/v1/auth/verify-email")
      .send({ token })
      .expect(200);

    expect(response.body.data.user.emailVerified).toBe(true);

    const me = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .expect(200);

    expect(me.body.data.user.emailVerified).toBe(true);
  });

  it("rejects a token that was already used", async () => {
    const user = await registerUser(app);
    const token = tokenFromEmail(lastEmailTo(user.email)!);

    await request(app)
      .post("/api/v1/auth/verify-email")
      .send({ token })
      .expect(200);

    const second = await request(app)
      .post("/api/v1/auth/verify-email")
      .send({ token })
      .expect(400);

    expect(second.body.error.code).toBe("INVALID_TOKEN");
  });

  it("rejects an expired token", async () => {
    const user = await registerUser(app);
    const token = tokenFromEmail(lastEmailTo(user.email)!);

    await prisma.authToken.updateMany({
      where: { userId: user.id, type: "EMAIL_VERIFY" },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });

    const response = await request(app)
      .post("/api/v1/auth/verify-email")
      .send({ token })
      .expect(400);

    expect(response.body.error.code).toBe("INVALID_TOKEN");
  });

  it("rejects an unknown token and a malformed body", async () => {
    const unknown = await request(app)
      .post("/api/v1/auth/verify-email")
      .send({ token: "x".repeat(43) })
      .expect(400);

    expect(unknown.body.error.code).toBe("INVALID_TOKEN");

    await request(app)
      .post("/api/v1/auth/verify-email")
      .send({ token: "short" })
      .expect(422);
  });
});

describe("POST /api/v1/auth/verify-email/resend", () => {
  it("requires authentication", async () => {
    await request(app).post("/api/v1/auth/verify-email/resend").expect(401);
  });

  it("issues a fresh link and invalidates the previous one", async () => {
    const user = await registerUser(app);
    const firstToken = tokenFromEmail(lastEmailTo(user.email)!);

    await request(app)
      .post("/api/v1/auth/verify-email/resend")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .expect(202);

    const secondToken = tokenFromEmail(lastEmailTo(user.email)!);

    expect(secondToken).not.toBe(firstToken);

    await request(app)
      .post("/api/v1/auth/verify-email")
      .send({ token: firstToken })
      .expect(400);

    await request(app)
      .post("/api/v1/auth/verify-email")
      .send({ token: secondToken })
      .expect(200);
  });

  it("refuses to resend once the address is confirmed", async () => {
    const user = await registerUser(app);
    const token = tokenFromEmail(lastEmailTo(user.email)!);

    await request(app)
      .post("/api/v1/auth/verify-email")
      .send({ token })
      .expect(200);

    const response = await request(app)
      .post("/api/v1/auth/verify-email/resend")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .expect(409);

    expect(response.body.error.code).toBe("EMAIL_ALREADY_VERIFIED");
  });

  it("limits resends per account", async () => {
    const user = await registerUser(app);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await request(app)
        .post("/api/v1/auth/verify-email/resend")
        .set("Authorization", `Bearer ${user.accessToken}`)
        .expect(202);
    }

    const response = await request(app)
      .post("/api/v1/auth/verify-email/resend")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .expect(429);

    expect(response.body.error.code).toBe("RATE_LIMITED");
  });
});

describe("session continuity", () => {
  it("keeps the user signed in after confirming the address", async () => {
    const user = await registerUser(app);
    const token = tokenFromEmail(lastEmailTo(user.email)!);

    await request(app)
      .post("/api/v1/auth/verify-email")
      .send({ token })
      .expect(200);

    const refreshed = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", user.cookie!)
      .expect(200);

    expect(refreshed.body.data.user.emailVerified).toBe(true);
    expect(refreshCookie(refreshed)).toBeDefined();
  });

  it("does not confirm a different account with a guessed id", async () => {
    const first = await registerUser(app);
    const second = await registerUser(app);
    const token = tokenFromEmail(lastEmailTo(first.email)!);

    await request(app)
      .post("/api/v1/auth/verify-email")
      .send({ token, userId: second.id, email: second.email })
      .expect(422);

    const me = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${second.accessToken}`)
      .expect(200);

    expect(me.body.data.user.emailVerified).toBe(false);
  });
});
