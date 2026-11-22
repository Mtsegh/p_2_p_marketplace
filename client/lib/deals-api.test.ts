import { afterEach, describe, expect, it, vi } from "vitest";
import { setAccessToken } from "./api";
import {
  acceptDeal,
  cancelDeal,
  createProposal,
  fetchDeal,
  fetchDeals,
  formatDealAmount,
  rejectDeal,
} from "./deals-api";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  setAccessToken(null);
});

const deal = {
  id: "deal-1",
  listingId: "listing-1",
  listingTitle: "A camera",
  buyerId: "buyer-1",
  sellerId: "seller-1",
  type: "SALE",
  amountCents: 9000,
  status: "PROPOSED",
  history: [],
};

describe("createProposal", () => {
  it("posts the offer and returns the deal", async () => {
    setAccessToken("token");
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ data: { deal } }, 201));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      createProposal({ listingId: "listing-1", amountCents: 9000 }),
    ).resolves.toEqual(deal);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/v1/deals");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(
      JSON.stringify({ listingId: "listing-1", amountCents: 9000 }),
    );
  });
});

describe("fetchDeal", () => {
  it("fetches a deal by id", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ data: { deal } }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchDeal("deal-1")).resolves.toEqual(deal);
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain("/api/v1/deals/deal-1");
  });
});

describe("fetchDeals", () => {
  it("passes role and status in the query", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ data: { deals: [deal], nextCursor: null } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await fetchDeals({ role: "seller", status: "PROPOSED" });
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain("role=seller");
    expect(url).toContain("status=PROPOSED");
  });
});

describe("deal transitions", () => {
  it("posts to the correct action URL", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(() => Promise.resolve(jsonResponse({ data: { deal } })));
    vi.stubGlobal("fetch", fetchMock);

    await acceptDeal("deal-1");
    expect((fetchMock.mock.calls[0] as [string])[0]).toContain(
      "/api/v1/deals/deal-1/accept",
    );

    await rejectDeal("deal-1");
    expect((fetchMock.mock.calls[1] as [string])[0]).toContain(
      "/api/v1/deals/deal-1/reject",
    );

    await cancelDeal("deal-1");
    expect((fetchMock.mock.calls[2] as [string])[0]).toContain(
      "/api/v1/deals/deal-1/cancel",
    );
  });
});

describe("formatDealAmount", () => {
  it("formats cents and exchange deals", () => {
    expect(formatDealAmount(9000)).toBe("$90.00");
    expect(formatDealAmount(null)).toBe("Exchange");
  });
});
