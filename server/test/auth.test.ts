import { randomUUID } from "node:crypto";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { prisma } from "../src/db/prisma.js";
import { hashRefreshToken } from "../src/modules/auth/tokens.js";
import {
  refreshCookie,
  registerUser,
  resetIdentityState,
  setCookies,
} from "./helpers.js";

const app = createApp();

beforeEach(async () => {
  await resetIdentityState();
});

describe("POST /api/v1/auth/register", () => {
  it("creates an account, returns a token, and sets the refresh cookie", async () => {
    const email = `Person-${randomUUID()}@Example.com`;

    const response = await request(app)
      .post("/api/v1/auth/register")
      .send({ email, password: "correct-horse-battery" })
      .expect(201);

    expect(response.body.data.user).toMatchObject({
      email: email.toLowerCase(),
      role: "USER",
      status: "ACTIVE",
      emailVerified: false,
      phoneVerified: false,
    });
    expect(response.body.data.user).not.toHaveProperty("passwordHash");
    expect(response.body.data.accessToken).toEqual(expect.any(String));
    expect(response.body.data.expiresIn).toBe(900);

    const cookie = setCookies(response).find((value) =>
      value.startsWith("marketplace_refresh="),
    );

    expect(cookie).toBeDefined();
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/api/v1/auth");
    expect(response.headers.location).toBe("/api/v1/auth/me");
  });

  it("rejects a duplicate email as a conflict, case-insensitively", async () => {
    const user = await registerUser(app);

    const response = await request(app)
      .post("/api/v1/auth/register")
      .send({
        email: user.email.toUpperCase(),
        password: "another-long-password",
      })
      .expect(409);

    expect(response.body.error).toMatchObject({
      code: "EMAIL_IN_USE",
      message: "An account with this email already exists",
    });
  });

  it("validates the body", async () => {
    const response = await request(app)
      .post("/api/v1/auth/register")
      .send({ email: "not-an-email", password: "short", unexpected: true })
      .expect(422);

    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(
      response.body.error.details.map(
        (detail: { field: string }) => detail.field,
      ),
    ).toEqual(expect.arrayContaining(["email", "password"]));
  });

  it("rejects writes from another origin", async () => {
    const response = await request(app)
      .post("/api/v1/auth/register")
      .set("Origin", "https://evil.example")
      .send({ email: "person@example.com", password: "correct-horse-battery" })
      .expect(403);

    expect(response.body.error.code).toBe("ORIGIN_NOT_ALLOWED");
  });

  it("limits signups per IP", async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await request(app)
        .post("/api/v1/auth/register")
        .send({
          email: `limit-${attempt}-${randomUUID()}@example.com`,
          password: "correct-horse-battery",
        })
        .expect(201);
    }

    const response = await request(app)
      .post("/api/v1/auth/register")
      .send({
        email: `limit-${randomUUID()}@example.com`,
        password: "correct-horse-battery",
      })
      .expect(429);

    expect(response.body.error.code).toBe("RATE_LIMITED");
    expect(response.headers["retry-after"]).toBeDefined();
  });
});

describe("POST /api/v1/auth/login", () => {
  it("signs in and returns the same account", async () => {
    const user = await registerUser(app);

    const response = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: user.email, password: user.password })
      .expect(200);

    expect(response.body.data.user.id).toBe(user.id);
    expect(refreshCookie(response)).toBeDefined();
  });

  it("answers the same way for a wrong password and an unknown email", async () => {
    const user = await registerUser(app);

    const wrongPassword = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: user.email, password: "wrong-password-123" })
      .expect(401);

    const unknownEmail = await request(app)
      .post("/api/v1/auth/login")
      .send({
        email: `nobody-${randomUUID()}@example.com`,
        password: "wrong-password-123",
      })
      .expect(401);

    expect(wrongPassword.body.error).toMatchObject({
      code: "INVALID_CREDENTIALS",
      message: "The email or password is incorrect",
    });
    expect(unknownEmail.body.error).toMatchObject({
      code: wrongPassword.body.error.code,
      message: wrongPassword.body.error.message,
    });
  });

  it("refuses a suspended account after checking the password", async () => {
    const user = await registerUser(app);
    await prisma.user.update({
      where: { id: user.id },
      data: { status: "SUSPENDED" },
    });

    const response = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: user.email, password: user.password })
      .expect(403);

    expect(response.body.error.code).toBe("ACCOUNT_SUSPENDED");
  });

  it("limits attempts per account", async () => {
    const user = await registerUser(app);

    for (let attempt = 0; attempt < 10; attempt += 1) {
      await request(app)
        .post("/api/v1/auth/login")
        .send({ email: user.email, password: "wrong-password-123" })
        .expect(401);
    }

    await request(app)
      .post("/api/v1/auth/login")
      .send({ email: user.email, password: "wrong-password-123" })
      .expect(429);
  });
});

describe("GET /api/v1/auth/me", () => {
  it("requires an access token", async () => {
    await request(app).get("/api/v1/auth/me").expect(401);
  });

  it("returns the signed-in account", async () => {
    const user = await registerUser(app);

    const response = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .expect(200);

    expect(response.body.data.user.id).toBe(user.id);
  });

  it("rejects a malformed token", async () => {
    await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", "Bearer not-a-jwt")
      .expect(401);
  });
});

describe("POST /api/v1/auth/refresh", () => {
  it("rotates the refresh token and returns a new access token", async () => {
    const user = await registerUser(app);

    const response = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", user.cookie!)
      .expect(200);

    const rotatedCookie = refreshCookie(response);

    expect(response.body.data.user.id).toBe(user.id);
    expect(response.body.data.accessToken).not.toBe(user.accessToken);
    expect(rotatedCookie).toBeDefined();
    expect(rotatedCookie).not.toBe(user.cookie);
  });

  it("tolerates a concurrent reuse inside the grace window", async () => {
    const user = await registerUser(app);

    const first = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", user.cookie!)
      .expect(200);
    const currentCookie = refreshCookie(first)!;

    // A second tab still holding the old cookie must get a 401, not a family
    // revocation that signs the first tab out.
    await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", user.cookie!)
      .expect(401);

    await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", currentCookie)
      .expect(200);
  });

  it("revokes the whole family when a stale token is replayed later", async () => {
    const user = await registerUser(app);

    const first = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", user.cookie!)
      .expect(200);
    const currentCookie = refreshCookie(first)!;

    const oldToken = user.cookie!.split("=")[1];
    await prisma.session.update({
      where: { tokenHash: hashRefreshToken(oldToken) },
      data: { revokedAt: new Date(Date.now() - 20_000) },
    });

    await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", user.cookie!)
      .expect(401);

    await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", currentCookie)
      .expect(401);
  });

  it("rejects a request with no cookie", async () => {
    await request(app).post("/api/v1/auth/refresh").expect(401);
  });
});

describe("POST /api/v1/auth/logout", () => {
  it("revokes the session, denylists the access token, and clears the cookie", async () => {
    const user = await registerUser(app);

    const response = await request(app)
      .post("/api/v1/auth/logout")
      .set("Cookie", user.cookie!)
      .expect(204);

    expect(refreshCookie(response)).toBe("marketplace_refresh=");
    expect(setCookies(response).join("; ")).toContain(
      "Expires=Thu, 01 Jan 1970",
    );

    await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .expect(401);

    await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", user.cookie!)
      .expect(401);
  });

  it("is idempotent without a cookie", async () => {
    await request(app).post("/api/v1/auth/logout").expect(204);
  });
});
