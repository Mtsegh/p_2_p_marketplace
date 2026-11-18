import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getAccessToken, setAccessToken } from "./api";
import {
  logoutAccount,
  refreshSession,
  registerAccount,
  requestPasswordReset,
  resetPassword,
  verifyEmailToken,
  type AuthUser,
} from "./auth-api";

const user: AuthUser = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "person@example.com",
  role: "USER",
  status: "ACTIVE",
  emailVerified: false,
  phoneVerified: false,
  createdAt: "2026-11-18T10:00:00.000Z",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function authPayload(token = "access-token-1") {
  return { data: { user, accessToken: token, expiresIn: 900 } };
}

beforeEach(() => {
  setAccessToken(null);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("registerAccount", () => {
  it("posts credentials and remembers the access token", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(authPayload(), 201));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      registerAccount({ email: user.email, password: "correct-horse-battery" }),
    ).resolves.toEqual(user);

    expect(getAccessToken()).toBe("access-token-1");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/v1/auth/register");
    expect(init.credentials).toBe("include");
    expect(init.body).toBe(
      JSON.stringify({ email: user.email, password: "correct-horse-battery" }),
    );
  });
});

describe("refreshSession", () => {
  it("returns null and clears the token when there is no session", async () => {
    setAccessToken("stale-token");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(
          {
            error: {
              code: "UNAUTHENTICATED",
              message: "No active session",
            },
          },
          401,
        ),
      ),
    );

    await expect(refreshSession()).resolves.toBeNull();
    expect(getAccessToken()).toBeNull();
  });

  it("shares one request between concurrent callers", async () => {
    let resolveResponse: (value: Response) => void = () => {};
    const pending = new Promise<Response>((resolve) => {
      resolveResponse = resolve;
    });
    const fetchMock = vi.fn().mockReturnValue(pending);
    vi.stubGlobal("fetch", fetchMock);

    const first = refreshSession();
    const second = refreshSession();
    resolveResponse(jsonResponse(authPayload("access-token-2")));

    await expect(Promise.all([first, second])).resolves.toEqual([user, user]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getAccessToken()).toBe("access-token-2");
  });
});

describe("logoutAccount", () => {
  it("clears the token even when the request fails", async () => {
    setAccessToken("access-token-3");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    await expect(logoutAccount()).rejects.toThrow("offline");
    expect(getAccessToken()).toBeNull();
  });
});

describe("verifyEmailToken", () => {
  it("posts the token and returns the confirmed user", async () => {
    const confirmed = { ...user, emailVerified: true };
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ data: { user: confirmed } }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(verifyEmailToken("token-from-email")).resolves.toEqual(
      confirmed,
    );

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];

    expect(url).toContain("/api/v1/auth/verify-email");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ token: "token-from-email" }));
  });
});

describe("requestPasswordReset", () => {
  it("posts the address", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ data: { status: "accepted" } }, 202));
    vi.stubGlobal("fetch", fetchMock);

    await expect(requestPasswordReset(user.email)).resolves.toBeUndefined();

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];

    expect(url).toContain("/api/v1/auth/password/forgot");
    expect(init.body).toBe(JSON.stringify({ email: user.email }));
  });
});

describe("resetPassword", () => {
  it("posts the token and password, then drops the access token", async () => {
    setAccessToken("access-token-4");
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      resetPassword("token-from-email", "a-brand-new-password"),
    ).resolves.toBeUndefined();

    expect(getAccessToken()).toBeNull();

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];

    expect(url).toContain("/api/v1/auth/password/reset");
    expect(init.body).toBe(
      JSON.stringify({
        token: "token-from-email",
        password: "a-brand-new-password",
      }),
    );
  });

  it("still drops the token when the API rejects the reset", async () => {
    setAccessToken("access-token-5");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(
          {
            error: {
              code: "INVALID_TOKEN",
              message: "This link is invalid or has expired.",
            },
          },
          400,
        ),
      ),
    );

    await expect(
      resetPassword("spent-token", "a-brand-new-password"),
    ).rejects.toThrow("This link is invalid or has expired.");
    expect(getAccessToken()).toBeNull();
  });
});
