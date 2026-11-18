import { randomUUID } from "node:crypto";
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
  type TestUser,
} from "./helpers.js";

const app = createApp();

beforeEach(async () => {
  await resetIdentityState();
});

function auth(user: TestUser) {
  return { Authorization: `Bearer ${user.accessToken}` };
}

describe("POST /api/v1/auth/password/change", () => {
  it("requires authentication", async () => {
    await request(app)
      .post("/api/v1/auth/password/change")
      .send({ currentPassword: "whatever", newPassword: "brand-new-password" })
      .expect(401);
  });

  it("rejects a wrong current password", async () => {
    const user = await registerUser(app);

    const response = await request(app)
      .post("/api/v1/auth/password/change")
      .set(auth(user))
      .send({
        currentPassword: "not-the-password",
        newPassword: "brand-new-password",
      })
      .expect(400);

    expect(response.body.error.code).toBe("INVALID_PASSWORD");
  });

  it("changes the password and signs out other devices only", async () => {
    const user = await registerUser(app);

    const otherDevice = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: user.email, password: user.password })
      .expect(200);
    const otherCookie = refreshCookie(otherDevice);

    await request(app)
      .post("/api/v1/auth/password/change")
      .set(auth(user))
      .send({
        currentPassword: user.password,
        newPassword: "brand-new-password",
      })
      .expect(204);

    await request(app)
      .post("/api/v1/auth/login")
      .send({ email: user.email, password: user.password })
      .expect(401);

    await request(app)
      .post("/api/v1/auth/login")
      .send({ email: user.email, password: "brand-new-password" })
      .expect(200);

    // The device that made the change stays signed in.
    await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", user.cookie!)
      .expect(200);

    // The other device does not.
    await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", otherCookie!)
      .expect(401);
  });
});

describe("POST /api/v1/auth/email/change", () => {
  it("needs the password, a new address, and a free address", async () => {
    const user = await registerUser(app);
    const other = await registerUser(app);

    const wrongPassword = await request(app)
      .post("/api/v1/auth/email/change")
      .set(auth(user))
      .send({ newEmail: `new-${randomUUID()}@example.com`, password: "nope" })
      .expect(400);
    expect(wrongPassword.body.error.code).toBe("INVALID_PASSWORD");

    const unchanged = await request(app)
      .post("/api/v1/auth/email/change")
      .set(auth(user))
      .send({ newEmail: user.email, password: user.password })
      .expect(409);
    expect(unchanged.body.error.code).toBe("EMAIL_UNCHANGED");

    const taken = await request(app)
      .post("/api/v1/auth/email/change")
      .set(auth(user))
      .send({ newEmail: other.email, password: user.password })
      .expect(409);
    expect(taken.body.error.code).toBe("EMAIL_IN_USE");
  });

  it("emails the new address and moves the account when confirmed", async () => {
    const user = await registerUser(app);
    const newEmail = `new-${randomUUID()}@example.com`;

    await request(app)
      .post("/api/v1/auth/email/change")
      .set(auth(user))
      .send({ newEmail, password: user.password })
      .expect(202);

    const email = lastEmailTo(newEmail);

    expect(email?.subject).toBe("Confirm your new email address");
    expect(email?.text).toContain("/email-change/confirm?token=");

    const token = tokenFromEmail(email!);
    const confirmed = await request(app)
      .post("/api/v1/auth/email/change/confirm")
      .send({ token })
      .expect(200);

    expect(confirmed.body.data).toEqual({ email: newEmail, userId: user.id });

    const me = await request(app)
      .get("/api/v1/auth/me")
      .set(auth(user))
      .expect(200);

    expect(me.body.data.user.email).toBe(newEmail);
    expect(me.body.data.user.emailVerified).toBe(true);

    await request(app)
      .post("/api/v1/auth/login")
      .send({ email: user.email, password: user.password })
      .expect(401);

    await request(app)
      .post("/api/v1/auth/login")
      .send({ email: newEmail, password: user.password })
      .expect(200);

    // Single use.
    await request(app)
      .post("/api/v1/auth/email/change/confirm")
      .send({ token })
      .expect(400);
  });

  it("rejects an expired or unknown confirmation token", async () => {
    const user = await registerUser(app);
    const newEmail = `expired-${randomUUID()}@example.com`;

    await request(app)
      .post("/api/v1/auth/email/change")
      .set(auth(user))
      .send({ newEmail, password: user.password })
      .expect(202);

    await prisma.authToken.updateMany({
      where: { userId: user.id, type: "EMAIL_CHANGE" },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });

    const expired = await request(app)
      .post("/api/v1/auth/email/change/confirm")
      .send({ token: tokenFromEmail(lastEmailTo(newEmail)!) })
      .expect(400);
    expect(expired.body.error.code).toBe("INVALID_TOKEN");

    const unknown = await request(app)
      .post("/api/v1/auth/email/change/confirm")
      .send({ token: "z".repeat(43) })
      .expect(400);
    expect(unknown.body.error.code).toBe("INVALID_TOKEN");
  });
});

describe("GET /api/v1/auth/account/export", () => {
  it("returns the account data without credentials", async () => {
    const user = await registerUser(app);

    await request(app)
      .patch("/api/v1/profiles/me")
      .set(auth(user))
      .send({ displayName: "Ade Balogun", location: "Lagos" })
      .expect(200);

    const response = await request(app)
      .get("/api/v1/auth/account/export")
      .set(auth(user))
      .expect(200);

    expect(response.headers["content-disposition"]).toContain("attachment");

    const body = response.body.data;
    expect(body.account.email).toBe(user.email);
    expect(body.profile.displayName).toBe("Ade Balogun");
    expect(body.sessions).toHaveLength(1);
    expect(body.exportedAt).toEqual(expect.any(String));
    expect(JSON.stringify(response.body)).not.toContain("passwordHash");
    expect(JSON.stringify(response.body)).not.toContain("tokenHash");
  });

  it("requires authentication", async () => {
    await request(app).get("/api/v1/auth/account/export").expect(401);
  });
});

describe("DELETE /api/v1/auth/account", () => {
  it("requires the password", async () => {
    const user = await registerUser(app);

    const response = await request(app)
      .delete("/api/v1/auth/account")
      .set(auth(user))
      .send({ password: "not-the-password" })
      .expect(400);

    expect(response.body.error.code).toBe("INVALID_PASSWORD");
  });

  it("removes personal data and ends every session", async () => {
    const user = await registerUser(app);

    await request(app)
      .patch("/api/v1/profiles/me")
      .set(auth(user))
      .send({ displayName: "Ade Balogun", bio: "Cameras.", location: "Lagos" })
      .expect(200);

    await request(app)
      .delete("/api/v1/auth/account")
      .set(auth(user))
      .send({ password: user.password })
      .expect(204);

    await request(app)
      .post("/api/v1/auth/login")
      .send({ email: user.email, password: user.password })
      .expect(401);

    await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", user.cookie!)
      .expect(401);

    await request(app).get(`/api/v1/profiles/${user.id}`).expect(404);

    await request(app)
      .get("/api/v1/auth/account/export")
      .set(auth(user))
      .expect(401);

    const row = await prisma.user.findUnique({ where: { id: user.id } });
    const profile = await prisma.profile.findUnique({
      where: { userId: user.id },
    });

    expect(row?.status).toBe("DELETED");
    expect(row?.email).not.toBe(user.email);
    expect(row?.email).not.toContain("@example.com");
    expect(row?.emailVerifiedAt).toBeNull();
    expect(row?.phoneE164).toBeNull();
    expect(profile?.displayName).toBe("");
    expect(profile?.bio).toBe("");
    expect(profile?.location).toBe("");

    await expect(
      prisma.session.count({ where: { userId: user.id, revokedAt: null } }),
    ).resolves.toBe(0);
    await expect(
      prisma.authToken.count({ where: { userId: user.id } }),
    ).resolves.toBe(0);
  });
});
