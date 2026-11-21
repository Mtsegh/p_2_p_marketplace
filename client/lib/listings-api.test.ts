import { afterEach, describe, expect, it, vi } from "vitest";
import { createListing, deleteListing, fetchCategories, fetchListing, fetchListings, publishListing, updateListing } from "./listings-api";
import { setAccessToken } from "./api";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const listing = {
  id: "11111111-1111-4111-8111-111111111111",
  ownerId: "22222222-2222-4222-8222-222222222222",
  ownerDisplayName: "Ade Balogun",
  categoryId: "33333333-3333-4333-8333-333333333333",
  categoryName: "Electronics",
  title: "Vintage camera",
  description: "Works great, lightly used.",
  condition: "GOOD",
  priceCents: 45000,
  listingType: "BOTH",
  status: "ACTIVE",
  location: "Lagos",
  createdAt: "2026-11-20T10:00:00.000Z",
  updatedAt: "2026-11-20T10:00:00.000Z",
};

afterEach(() => {
  vi.unstubAllGlobals();
  setAccessToken(null);
});

describe("createListing", () => {
  it("posts the listing and returns it", async () => {
    setAccessToken("access-token-1");
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ data: { listing } }, 201),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      createListing({
        title: listing.title,
        description: listing.description,
        location: listing.location,
      }),
    ).resolves.toEqual(listing);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);

    expect(url).toContain("/api/v1/listings");
    expect(init.method).toBe("POST");
    expect(headers.get("Authorization")).toBe("Bearer access-token-1");
    expect(init.body).toContain(listing.title);
  });
});

describe("fetchListings", () => {
  it("fetches public listings with query params", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ data: { listings: [listing], nextCursor: null } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchListings({ category: "electronics", limit: 10 }),
    ).resolves.toEqual({ listings: [listing], nextCursor: null });

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain("/api/v1/listings");
    expect(url).toContain("category=electronics");
    expect(url).toContain("limit=10");
  });
});

describe("fetchListing", () => {
  it("fetches a single listing by id", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ data: { listing } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchListing(listing.id)).resolves.toEqual(listing);

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain(`/api/v1/listings/${listing.id}`);
  });
});

describe("updateListing", () => {
  it("patches a listing and returns it", async () => {
    setAccessToken("access-token-2");
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ data: { listing } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(updateListing(listing.id, { title: "New title" })).resolves.toEqual(listing);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);

    expect(url).toContain(`/api/v1/listings/${listing.id}`);
    expect(init.method).toBe("PATCH");
    expect(headers.get("Authorization")).toBe("Bearer access-token-2");
    expect(init.body).toContain("New title");
  });
});

describe("deleteListing", () => {
  it("deletes a listing and returns undefined", async () => {
    setAccessToken("access-token-3");
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(deleteListing(listing.id)).resolves.toBeUndefined();

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];

    expect(url).toContain(`/api/v1/listings/${listing.id}`);
    expect(init.method).toBe("DELETE");
  });
});

describe("publishListing", () => {
  it("publishes a draft listing", async () => {
    setAccessToken("access-token-4");
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ data: { listing } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(publishListing(listing.id)).resolves.toEqual(listing);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];

    expect(url).toContain(`/api/v1/listings/${listing.id}/publish`);
    expect(init.method).toBe("POST");
  });
});

describe("fetchCategories", () => {
  it("fetches all categories", async () => {
    const categories = [
      { id: "c1", name: "Electronics", slug: "electronics", activeListingCount: 5 },
      { id: "c2", name: "Books", slug: "books", activeListingCount: 0 },
    ];
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ data: { categories } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchCategories()).resolves.toEqual(categories);

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain("/api/v1/listings/categories");
  });
});
