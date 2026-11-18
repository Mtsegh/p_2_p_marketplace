import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { createAdmin, registerUser, resetIdentityState } from "./helpers.js";

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
