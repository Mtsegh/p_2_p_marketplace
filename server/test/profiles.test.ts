import { randomUUID } from "node:crypto";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { prisma } from "../src/db/prisma.js";
import { registerUser, resetIdentityState } from "./helpers.js";

const app = createApp();

beforeEach(async () => {
  await resetIdentityState();
});

function update(token: string, body: object) {
  return request(app)
    .patch("/api/v1/profiles/me")
    .set("Authorization", `Bearer ${token}`)
    .send(body);
}

describe("PATCH /api/v1/profiles/me", () => {
  it("requires authentication", async () => {
    await request(app)
      .patch("/api/v1/profiles/me")
      .send({ displayName: "Ade" })
      .expect(401);
  });

  it("saves the profile and returns the updated user", async () => {
    const user = await registerUser(app);

    const response = await update(user.accessToken, {
      displayName: "Ade Balogun",
      bio: "Trades cameras and bike parts.",
      location: "Lagos",
    }).expect(200);

    expect(response.body.data.user).toMatchObject({
      id: user.id,
      displayName: "Ade Balogun",
      bio: "Trades cameras and bike parts.",
      location: "Lagos",
    });

    const me = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .expect(200);

    expect(me.body.data.user.displayName).toBe("Ade Balogun");
    expect(me.body.data.user.location).toBe("Lagos");
  });

  it("trims input and allows clearing the optional fields", async () => {
    const user = await registerUser(app);

    await update(user.accessToken, {
      displayName: "  Ade  ",
      bio: "  hello  ",
      location: "  Lagos  ",
    }).expect(200);

    const cleared = await update(user.accessToken, {
      bio: "   ",
      location: "",
    }).expect(200);

    expect(cleared.body.data.user.displayName).toBe("Ade");
    expect(cleared.body.data.user.bio).toBe("");
    expect(cleared.body.data.user.location).toBe("");
  });

  it("rejects an empty name, control characters, and unknown keys", async () => {
    const user = await registerUser(app);

    const empty = await update(user.accessToken, { displayName: "   " }).expect(
      422,
    );
    expect(empty.body.error.details[0].field).toBe("displayName");

    await update(user.accessToken, { displayName: "Ade\u0000" }).expect(422);

    const unknown = await update(user.accessToken, {
      displayName: "Ade",
      email: "someone@example.com",
    }).expect(422);
    expect(unknown.body.error.code).toBe("VALIDATION_ERROR");

    const nothing = await update(user.accessToken, {}).expect(422);
    expect(nothing.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("refuses another origin", async () => {
    const user = await registerUser(app);

    await request(app)
      .patch("/api/v1/profiles/me")
      .set("Origin", "https://evil.example")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ displayName: "Ade" })
      .expect(403);
  });
});

describe("GET /api/v1/profiles/:userId", () => {
  it("shows the public profile and never the email", async () => {
    const user = await registerUser(app);

    await update(user.accessToken, {
      displayName: "Ade Balogun",
      bio: "Trades cameras.",
      location: "Lagos",
    }).expect(200);

    const response = await request(app)
      .get(`/api/v1/profiles/${user.id}`)
      .expect(200);

    expect(response.body.data.profile).toEqual({
      id: user.id,
      displayName: "Ade Balogun",
      bio: "Trades cameras.",
      location: "Lagos",
      memberSince: expect.any(String),
      emailVerified: false,
      phoneVerified: false,
    });
    expect(JSON.stringify(response.body)).not.toContain(user.email);
    expect(response.body.data.profile).not.toHaveProperty("email");
  });

  it("answers 404 for an unknown, suspended, or deleted account", async () => {
    await request(app).get(`/api/v1/profiles/${randomUUID()}`).expect(404);

    const suspended = await registerUser(app);
    await prisma.user.update({
      where: { id: suspended.id },
      data: { status: "SUSPENDED" },
    });

    await request(app).get(`/api/v1/profiles/${suspended.id}`).expect(404);

    const deleted = await registerUser(app);
    await prisma.user.update({
      where: { id: deleted.id },
      data: { status: "DELETED" },
    });

    await request(app).get(`/api/v1/profiles/${deleted.id}`).expect(404);
  });

  it("rejects a malformed id", async () => {
    const response = await request(app)
      .get("/api/v1/profiles/not-a-uuid")
      .expect(422);

    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });
});
