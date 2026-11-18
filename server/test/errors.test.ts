import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";

const app = createApp();

describe("API envelope", () => {
  it("returns data for a valid request", async () => {
    const response = await request(app)
      .get("/api/v1/ping")
      .query({ name: "Ada" })
      .expect(200);

    expect(response.body).toMatchObject({
      data: { message: "pong, Ada" },
    });
    expect(typeof response.body.meta.requestId).toBe("string");
  });

  it("uses the standard error shape for validation failures", async () => {
    const response = await request(app)
      .get("/api/v1/ping")
      .query({ name: "" })
      .expect(422);

    expect(response.body.error).toMatchObject({
      code: "VALIDATION_ERROR",
      message: "Request validation failed",
    });
    expect(response.body.error.details).toEqual([
      expect.objectContaining({ field: "name" }),
    ]);
    expect(response.body.error.requestId).toBe(
      response.headers["x-request-id"],
    );
  });

  it("returns the standard shape for unknown routes", async () => {
    const response = await request(app).get("/api/v1/nope").expect(404);

    expect(response.body.error).toMatchObject({ code: "NOT_FOUND" });
    expect(response.body.error.requestId).toBe(
      response.headers["x-request-id"],
    );
  });

  it("rejects malformed JSON with a 400", async () => {
    const response = await request(app)
      .post("/api/v1/ping")
      .set("Content-Type", "application/json")
      .send("{not json")
      .expect(400);

    expect(response.body.error.code).toBe("INVALID_JSON");
  });

  it("echoes a valid client request ID", async () => {
    const response = await request(app)
      .get("/api/v1/ping")
      .set("X-Request-Id", "test-request-123")
      .expect(200);

    expect(response.headers["x-request-id"]).toBe("test-request-123");
    expect(response.body.meta.requestId).toBe("test-request-123");
  });

  it("replaces an unsafe client request ID", async () => {
    const response = await request(app)
      .get("/api/v1/ping")
      .set("X-Request-Id", "bad id with spaces")
      .expect(200);

    expect(response.headers["x-request-id"]).not.toBe("bad id with spaces");
  });
});
