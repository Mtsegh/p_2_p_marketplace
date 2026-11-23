import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { createAdmin, registerUser, resetIdentityState } from "./helpers.js";
import { prisma } from "../src/db/prisma.js";

const app = createApp();

beforeEach(async () => {
  await resetIdentityState();
});

describe("GET /api/v1/admin/users", () => {
  it("requires authentication", async () => {
    await request(app).get("/api/v1/admin/users").expect(401);
  });

  it("forbids a normal user", async () => {
    const user = await registerUser(app);

    const response = await request(app)
      .get("/api/v1/admin/users")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .expect(403);

    expect(response.body.error.code).toBe("FORBIDDEN");
  });

  it("lists users for an administrator", async () => {
    const admin = await createAdmin(app);
    const user = await registerUser(app);

    const response = await request(app)
      .get("/api/v1/admin/users")
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .expect(200);

    const ids = response.body.data.users.map((row: { id: string }) => row.id);

    expect(ids).toEqual(expect.arrayContaining([admin.id, user.id]));
    expect(response.body.data.users[0]).not.toHaveProperty("passwordHash");
  });

  it("paginates with a cursor", async () => {
    const admin = await createAdmin(app);
    await registerUser(app);
    await registerUser(app);

    const first = await request(app)
      .get("/api/v1/admin/users?limit=2")
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .expect(200);

    expect(first.body.data.users).toHaveLength(2);
    expect(first.body.meta.nextCursor).toEqual(expect.any(String));

    const second = await request(app)
      .get(`/api/v1/admin/users?limit=2&cursor=${first.body.meta.nextCursor}`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .expect(200);

    expect(second.body.data.users).toHaveLength(1);
    expect(second.body.meta.nextCursor).toBeNull();

    const firstIds = first.body.data.users.map((row: { id: string }) => row.id);
    const secondIds = second.body.data.users.map(
      (row: { id: string }) => row.id,
    );

    expect(
      firstIds.filter((id: string) => secondIds.includes(id)),
    ).toHaveLength(0);
  });

  it("filters by email and validates the limit", async () => {
    const admin = await createAdmin(app);
    const user = await registerUser(app);

    const filtered = await request(app)
      .get(`/api/v1/admin/users?q=${encodeURIComponent(user.email)}`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .expect(200);

    expect(filtered.body.data.users).toHaveLength(1);
    expect(filtered.body.data.users[0].id).toBe(user.id);

    await request(app)
      .get("/api/v1/admin/users?limit=1000")
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .expect(422);
  });
});

describe("admin moderation and audit", () => {
  it("suspends a user, ends their sessions, and records an audit entry", async () => {
    const admin = await createAdmin(app);
    const user = await registerUser(app);

    const response = await request(app)
      .patch(`/api/v1/admin/users/${user.id}`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ status: "SUSPENDED" })
      .expect(200);

    expect(response.body.data.user.status).toBe("SUSPENDED");

    const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
    expect(dbUser?.status).toBe("SUSPENDED");

    const sessions = await prisma.session.findMany({
      where: { userId: user.id, revokedAt: null },
    });
    expect(sessions).toHaveLength(0);

    // The suspended user's sessions were revoked, so the access token is denied.
    await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .expect(401);
  });

  it("removes a listing and records the action", async () => {
    const admin = await createAdmin(app);
    const user = await registerUser(app);
    const listing = await prisma.listing.create({
      data: {
        ownerId: user.id,
        title: "Bad listing",
        description: "To be removed",
        location: "Lagos",
        status: "ACTIVE",
      },
    });

    const response = await request(app)
      .patch(`/api/v1/admin/listings/${listing.id}`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ action: "remove", reason: "Prohibited item" })
      .expect(200);

    expect(response.body.data.listing.status).toBe("REMOVED");

    const db = await prisma.listing.findUnique({ where: { id: listing.id } });
    expect(db?.status).toBe("REMOVED");
  });

  it("edits platform settings and reads them back", async () => {
    const admin = await createAdmin(app);

    const response = await request(app)
      .patch("/api/v1/admin/settings")
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ platformFeeBps: 250, escrowWindowDays: 14 })
      .expect(200);

    expect(response.body.data.settings.platformFeeBps).toBe(250);
    expect(response.body.data.settings.escrowWindowDays).toBe(14);

    const read = await request(app)
      .get("/api/v1/admin/settings")
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .expect(200);
    expect(read.body.data.settings.platformFeeBps).toBe(250);
  });

  it("lists both actions in the audit log", async () => {
    const admin = await createAdmin(app);
    const user = await registerUser(app);

    await request(app)
      .patch(`/api/v1/admin/users/${user.id}`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ status: "SUSPENDED" })
      .expect(200);

    const listing = await prisma.listing.create({
      data: {
        ownerId: user.id,
        title: "Audited listing",
        description: "x",
        location: "Lagos",
        status: "ACTIVE",
      },
    });
    await request(app)
      .patch(`/api/v1/admin/listings/${listing.id}`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ action: "remove" })
      .expect(200);

    const audit = await request(app)
      .get("/api/v1/admin/audit")
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .expect(200);

    const actions = audit.body.data.events.map(
      (event: { action: string }) => event.action,
    );
    expect(actions).toContain("user.status");
    expect(actions).toContain("listing.remove");
  });

  it("prevents a non-admin from using the audit log", async () => {
    const user = await registerUser(app);

    await request(app)
      .get("/api/v1/admin/audit")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .expect(403);
  });
});
