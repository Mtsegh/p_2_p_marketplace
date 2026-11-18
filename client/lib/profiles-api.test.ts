import { afterEach, describe, expect, it, vi } from "vitest";
import { setAccessToken } from "./api";
import { fetchPublicProfile, updateProfile } from "./profiles-api";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const profile = {
  id: "11111111-1111-4111-8111-111111111111",
  displayName: "Ade Balogun",
  bio: "Trades cameras.",
  location: "Lagos",
  memberSince: "2026-11-18T10:00:00.000Z",
  emailVerified: true,
  phoneVerified: false,
};

afterEach(() => {
  vi.unstubAllGlobals();
  setAccessToken(null);
});

describe("fetchPublicProfile", () => {
  it("requests the member by id and unwraps the profile", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ data: { profile } }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchPublicProfile(profile.id)).resolves.toEqual(profile);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];

    expect(url).toContain(`/api/v1/profiles/${profile.id}`);
    expect(init.method).toBeUndefined();
  });

  it("encodes the id so a crafted path cannot escape the route", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ data: { profile } }));
    vi.stubGlobal("fetch", fetchMock);

    await fetchPublicProfile("../../auth/me");

    const [url] = fetchMock.mock.calls[0] as [string];

    expect(url).toContain("/api/v1/profiles/..%2F..%2Fauth%2Fme");
  });
});

describe("updateProfile", () => {
  it("patches the profile and returns the updated user", async () => {
    setAccessToken("access-token");
    const user = {
      id: profile.id,
      email: "person@example.com",
      role: "USER",
      status: "ACTIVE",
      emailVerified: true,
      phoneVerified: false,
      createdAt: profile.memberSince,
      displayName: profile.displayName,
      bio: profile.bio,
      location: profile.location,
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ data: { user } }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      updateProfile({ displayName: profile.displayName }),
    ).resolves.toEqual(user);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);

    expect(url).toContain("/api/v1/profiles/me");
    expect(init.method).toBe("PATCH");
    expect(headers.get("Authorization")).toBe("Bearer access-token");
    expect(init.body).toBe(
      JSON.stringify({ displayName: profile.displayName }),
    );
  });
});
