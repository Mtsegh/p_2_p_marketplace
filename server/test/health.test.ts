import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";

const app = createApp();

describe("health endpoints", () => {
  it("reports liveness without touching dependencies", async () => {
    const response = await request(app).get("/health/live").expect(200);

    expect(response.body.data).toMatchObject({ status: "ok" });
    expect(typeof response.body.data.uptimeSeconds).toBe("number");
    expect(typeof response.body.data.timestamp).toBe("string");
  });

  it("reports readiness with Postgres and Redis up", async () => {
    const response = await request(app).get("/health/ready").expect(200);

    expect(response.body.data).toMatchObject({
      status: "ok",
      checks: { database: "up", redis: "up" },
    });
  }, 20_000);

  it("serves /health as an alias for readiness", async () => {
    const response = await request(app).get("/health").expect(200);

    expect(response.body.data.status).toBe("ok");
  }, 20_000);
});
