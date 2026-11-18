import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, fetchHealth, type HealthReport } from "./api";

const report: HealthReport = {
  status: "ok",
  checks: { database: "up", redis: "up" },
  timestamp: "2026-11-18T10:00:00.000Z",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchHealth", () => {
  it("returns the health report from the data envelope", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ data: report })),
    );

    await expect(fetchHealth()).resolves.toEqual(report);
  });

  it("throws ApiError with the server code and request ID", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(
          {
            error: {
              code: "NOT_FOUND",
              message: "Route not found",
              requestId: "req-1",
            },
          },
          404,
        ),
      ),
    );

    const error: unknown = await fetchHealth().catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 404,
      code: "NOT_FOUND",
      requestId: "req-1",
    });
  });

  it("wraps an unexpected error body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse("upstream failure", 502)),
    );

    const error: unknown = await fetchHealth().catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 502,
      code: "UNEXPECTED_RESPONSE",
    });
  });
});
