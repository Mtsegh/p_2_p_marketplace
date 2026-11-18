import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { refreshCookie, registerUser, resetIdentityState } from "./helpers.js";

const app = createApp();

beforeEach(async () => {
  await resetIdentityState();
});

describe("GET /api/v1/auth/sessions", () => {
  it("lists the caller's active sessions and marks the current one", async () => {
    const user = await registerUser(app);

    const secondLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: user.email, password: user.password })
      .expect(200);

    const response = await request(app)
      .get("/api/v1/auth/sessions")
      .set("Authorization", `Bearer ${secondLogin.body.data.accessToken}`)
      .expect(200);

    expect(response.body.data.sessions).toHaveLength(2);
    expect(
      response.body.data.sessions.filter(
        (session: { current: boolean }) => session.current,
      ),
    ).toHaveLength(1);
  });

  it("requires authentication", async () => {
    await request(app).get("/api/v1/auth/sessions").expect(401);
  });
});

describe("DELETE /api/v1/auth/sessions/:sessionId", () => {
  it("revokes another device and refuses its refresh token", async () => {
    const user = await registerUser(app);

    const secondLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: user.email, password: user.password })
      .expect(200);
    const currentToken = secondLogin.body.data.accessToken as string;
    const currentCookie = refreshCookie(secondLogin)!;

    const list = await request(app)
      .get("/api/v1/auth/sessions")
      .set("Authorization", `Bearer ${currentToken}`)
      .expect(200);

    const other = list.body.data.sessions.find(
      (session: { current: boolean }) => !session.current,
    ) as { id: string };

    await request(app)
      .delete(`/api/v1/auth/sessions/${other.id}`)
      .set("Authorization", `Bearer ${currentToken}`)
      .expect(204);

    await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", user.cookie!)
      .expect(401);

    await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", currentCookie)
      .expect(200);
  });

  it("returns 404 for a session owned by someone else", async () => {
    const owner = await registerUser(app);
    const attacker = await registerUser(app);

    const list = await request(app)
      .get("/api/v1/auth/sessions")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .expect(200);

    await request(app)
      .delete(`/api/v1/auth/sessions/${list.body.data.sessions[0].id}`)
      .set("Authorization", `Bearer ${attacker.accessToken}`)
      .expect(404);

    // The owner's session is untouched.
    await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", owner.cookie!)
      .expect(200);
  });

  it("signs the current device out when it revokes its own session", async () => {
    const user = await registerUser(app);

    const list = await request(app)
      .get("/api/v1/auth/sessions")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .expect(200);

    const current = list.body.data.sessions.find(
      (session: { current: boolean }) => session.current,
    ) as { id: string };

    const response = await request(app)
      .delete(`/api/v1/auth/sessions/${current.id}`)
      .set("Authorization", `Bearer ${user.accessToken}`)
      .expect(204);

    expect(refreshCookie(response)).toBe("marketplace_refresh=");

    await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .expect(401);
  });
});
