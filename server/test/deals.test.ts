import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { prisma } from "../src/db/prisma.js";
import { registerUser, resetIdentityState } from "./helpers.js";

const app = createApp();

beforeEach(async () => {
  await resetIdentityState();
});

/** Creates a verified seller, a verified buyer, and an active listing. */
async function setup() {
  const seller = await registerUser(app);
  const buyer = await registerUser(app);

  await prisma.user.updateMany({
    where: { id: { in: [seller.id, buyer.id] } },
    data: { emailVerifiedAt: new Date() },
  });

  const listing = await prisma.listing.create({
    data: {
      ownerId: seller.id,
      title: "A camera",
      description: "Good condition",
      location: "Lagos",
      status: "ACTIVE",
      priceCents: 10000,
    },
  });

  return { seller, buyer, listing };
}

function auth(token: string) {
  return (req: request.Test) =>
    req.set("Authorization", `Bearer ${token}`);
}

function propose(token: string, listingId: string, amountCents = 9000) {
  return auth(token)(
    request(app)
      .post("/api/v1/deals")
      .set("Origin", "http://localhost:3000")
      .send({ listingId, amountCents }),
  );
}

async function swapSetup() {
  const base = await setup();
  await prisma.listing.update({
    where: { id: base.listing.id },
    data: { listingType: "BOTH", priceCents: null },
  });
  const offered = await prisma.listing.createManyAndReturn({
    data: [
      {
        ownerId: base.buyer.id,
        title: "Buyer item 1",
        description: "Offered in swap",
        location: "Lagos",
        status: "ACTIVE",
        listingType: "EXCHANGE",
      },
      {
        ownerId: base.buyer.id,
        title: "Buyer item 2",
        description: "Offered in swap",
        location: "Lagos",
        status: "ACTIVE",
        listingType: "EXCHANGE",
      },
    ],
  });
  return { ...base, offered };
}

function exchange(
  token: string,
  listingId: string,
  offeredListingIds: string[],
  topUpCents?: number,
) {
  return auth(token)(
    request(app)
      .post("/api/v1/deals/exchange")
      .set("Origin", "http://localhost:3000")
      .send({
        listingId,
        offeredListingIds,
        ...(topUpCents !== undefined ? { topUpCents } : {}),
      }),
  );
}

describe("POST /api/v1/deals", () => {
  it("creates a PROPOSED sale deal with a history entry", async () => {
    const { buyer, listing } = await setup();

    const response = await propose(
      buyer.accessToken,
      listing.id,
    ).expect(201);

    expect(response.body.data.deal).toMatchObject({
      listingId: listing.id,
      buyerId: buyer.id,
      status: "PROPOSED",
      type: "SALE",
      amountCents: 9000,
    });
    expect(response.body.data.deal.history).toHaveLength(1);
  });

  it("rejects a proposal on your own listing", async () => {
    const { seller, listing } = await setup();

    await propose(seller.accessToken, listing.id).expect(422);
  });

  it("rejects a proposal on a non-active listing", async () => {
    const { buyer, listing } = await setup();

    await prisma.listing.update({
      where: { id: listing.id },
      data: { status: "DRAFT" },
    });

    await propose(buyer.accessToken, listing.id).expect(409);
  });

  it("rejects a duplicate proposal from the same buyer", async () => {
    const { buyer, listing } = await setup();

    await propose(buyer.accessToken, listing.id).expect(201);
    await propose(buyer.accessToken, listing.id).expect(409);
  });

  it("requires a verified email", async () => {
    const { buyer, listing } = await setup();

    await prisma.user.update({
      where: { id: buyer.id },
      data: { emailVerifiedAt: null },
    });

    await propose(buyer.accessToken, listing.id).expect(403);
  });
});

describe("POST /api/v1/deals/:dealId/accept", () => {
  it("accepts a proposal, reserves the listing, and rejects competing proposals", async () => {
    const { seller, buyer, listing } = await setup();
    const otherBuyer = await registerUser(app);
    await prisma.user.update({
      where: { id: otherBuyer.id },
      data: { emailVerifiedAt: new Date() },
    });

    const first = await propose(buyer.accessToken, listing.id).expect(201);
    const second = await propose(
      otherBuyer.accessToken,
      listing.id,
      9500,
    ).expect(201);

    const accepted = await auth(seller.accessToken)(
      request(app)
        .post(`/api/v1/deals/${first.body.data.deal.id}/accept`)
        .set("Origin", "http://localhost:3000"),
    ).expect(200);

    expect(accepted.body.data.deal.status).toBe("ACCEPTED");
    expect(accepted.body.data.deal.history).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ toStatus: "ACCEPTED" }),
      ]),
    );

    const reserved = await prisma.listing.findUnique({
      where: { id: listing.id },
    });
    expect(reserved?.status).toBe("RESERVED");

    const competitor = await prisma.deal.findUnique({
      where: { id: second.body.data.deal.id },
    });
    expect(competitor?.status).toBe("REJECTED");

    // The competing rejection is recorded in history.
    const competitorHistory = await prisma.dealHistory.findMany({
      where: { dealId: competitor!.id },
    });
    expect(competitorHistory).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ toStatus: "REJECTED" }),
      ]),
    );
  });

  it("only the seller can accept", async () => {
    const { buyer, listing } = await setup();
    const deal = await propose(buyer.accessToken, listing.id).expect(201);

    await auth(buyer.accessToken)(
      request(app)
        .post(`/api/v1/deals/${deal.body.data.deal.id}/accept`)
        .set("Origin", "http://localhost:3000"),
    ).expect(403);
  });

  it("cannot accept a deal that is not PROPOSED", async () => {
    const { seller, buyer, listing } = await setup();
    const deal = await propose(buyer.accessToken, listing.id).expect(201);

    await auth(buyer.accessToken)(
      request(app)
        .post(`/api/v1/deals/${deal.body.data.deal.id}/cancel`)
        .set("Origin", "http://localhost:3000"),
    ).expect(200);

    await auth(seller.accessToken)(
      request(app)
        .post(`/api/v1/deals/${deal.body.data.deal.id}/accept`)
        .set("Origin", "http://localhost:3000"),
    ).expect(409);
  });
});

describe("reject and cancel", () => {
  it("lets the seller reject a proposal", async () => {
    const { seller, buyer, listing } = await setup();
    const deal = await propose(buyer.accessToken, listing.id).expect(201);

    const response = await auth(seller.accessToken)(
      request(app)
        .post(`/api/v1/deals/${deal.body.data.deal.id}/reject`)
        .set("Origin", "http://localhost:3000"),
    ).expect(200);

    expect(response.body.data.deal.status).toBe("REJECTED");
  });

  it("lets the buyer cancel a proposal", async () => {
    const { buyer, listing } = await setup();
    const deal = await propose(buyer.accessToken, listing.id).expect(201);

    const response = await auth(buyer.accessToken)(
      request(app)
        .post(`/api/v1/deals/${deal.body.data.deal.id}/cancel`)
        .set("Origin", "http://localhost:3000"),
    ).expect(200);

    expect(response.body.data.deal.status).toBe("CANCELLED");
  });

  it("a stranger cannot act on a deal", async () => {
    const { buyer, listing } = await setup();
    const stranger = await registerUser(app);
    const deal = await propose(buyer.accessToken, listing.id).expect(201);

    await auth(stranger.accessToken)(
      request(app)
        .get(`/api/v1/deals/${deal.body.data.deal.id}`),
    ).expect(403);
  });
});

describe("GET /api/v1/deals", () => {
  it("lists only the caller's deals", async () => {
    const { buyer, listing } = await setup();
    const deal = await propose(buyer.accessToken, listing.id).expect(201);

    const buyerList = await auth(buyer.accessToken)(
      request(app).get("/api/v1/deals").query({ role: "buyer" }),
    ).expect(200);
    expect(buyerList.body.data.deals).toHaveLength(1);
    expect(buyerList.body.data.deals[0].id).toBe(deal.body.data.deal.id);

    const other = await registerUser(app);
    const otherList = await auth(other.accessToken)(
      request(app).get("/api/v1/deals"),
    ).expect(200);
    expect(otherList.body.data.deals).toHaveLength(0);
  });
});

describe("exchange proposals", () => {
  it("creates an exchange proposal with offered listings and a top-up", async () => {
    const { buyer, listing, offered } = await swapSetup();

    const response = await exchange(
      buyer.accessToken,
      listing.id,
      offered.map((item) => item.id),
      1000,
    ).expect(201);

    expect(response.body.data.deal.type).toBe("EXCHANGE");
    expect(response.body.data.deal.amountCents).toBe(1000);
    expect(response.body.data.deal.offeredListings).toHaveLength(2);
  });

  it("rejects offered listings the buyer does not own", async () => {
    const { buyer, listing, seller } = await swapSetup();

    const foreign = await prisma.listing.create({
      data: {
        ownerId: seller.id,
        title: "Seller item",
        description: "Not the buyer's",
        location: "Lagos",
        status: "ACTIVE",
      },
    });

    await exchange(buyer.accessToken, listing.id, [foreign.id]).expect(422);
  });

  it("rejects an exchange proposal with no offered listings", async () => {
    const { buyer, listing } = await swapSetup();

    await exchange(buyer.accessToken, listing.id, []).expect(422);
  });

  it("reserves all listings involved when an exchange is accepted", async () => {
    const { seller, buyer, listing, offered } = await swapSetup();

    const response = await exchange(
      buyer.accessToken,
      listing.id,
      offered.map((item) => item.id),
    ).expect(201);

    await auth(seller.accessToken)(
      request(app)
        .post(`/api/v1/deals/${response.body.data.deal.id}/accept`)
        .set("Origin", "http://localhost:3000"),
    ).expect(200);

    const statuses = await prisma.listing.findMany({
      where: { id: { in: [listing.id, ...offered.map((item) => item.id)] } },
      select: { id: true, status: true },
    });

    expect(statuses).toHaveLength(3);
    expect(statuses.every((item) => item.status === "RESERVED")).toBe(true);
  });

  it("allows only participants to read and write the deal thread", async () => {
    const { seller, buyer, listing } = await setup();
    const deal = await propose(buyer.accessToken, listing.id).expect(201);
    const dealId = deal.body.data.deal.id;
    const stranger = await registerUser(app);

    // A stranger cannot read or post.
    await auth(stranger.accessToken)(
      request(app).get(`/api/v1/deals/${dealId}/messages`),
    ).expect(403);
    await auth(stranger.accessToken)(
      request(app)
        .post(`/api/v1/deals/${dealId}/messages`)
        .set("Origin", "http://localhost:3000")
        .send({ body: "intruder" }),
    ).expect(403);

    // Buyer posts, seller reads.
    const posted = await auth(buyer.accessToken)(
      request(app)
        .post(`/api/v1/deals/${dealId}/messages`)
        .set("Origin", "http://localhost:3000")
        .send({ body: "Where should we meet?" }),
    ).expect(201);
    expect(posted.body.data.message.body).toBe("Where should we meet?");

    const thread = await auth(seller.accessToken)(
      request(app).get(`/api/v1/deals/${dealId}/messages`),
    ).expect(200);
    expect(thread.body.data.messages).toHaveLength(1);
    expect(thread.body.data.messages[0].body).toBe("Where should we meet?");
  });

  it("validates message bodies", async () => {
    const { buyer, listing } = await setup();
    const deal = await propose(buyer.accessToken, listing.id).expect(201);

    await auth(buyer.accessToken)(
      request(app)
        .post(`/api/v1/deals/${deal.body.data.deal.id}/messages`)
        .set("Origin", "http://localhost:3000")
        .send({ body: "" }),
    ).expect(422);
  });
});

describe("deal messages pagination", () => {
  it("pages through messages oldest-first", async () => {
    const { seller, buyer, listing } = await setup();
    const deal = await propose(buyer.accessToken, listing.id).expect(201);
    const dealId = deal.body.data.deal.id;

    for (let i = 1; i <= 5; i += 1) {
      await auth(buyer.accessToken)(
        request(app)
          .post(`/api/v1/deals/${dealId}/messages`)
          .set("Origin", "http://localhost:3000")
          .send({ body: `Message ${i}` }),
      ).expect(201);
    }

    const seen: string[] = [];
    let cursor: string | undefined;

    do {
      const response = await auth(seller.accessToken)(
        request(app)
          .get(`/api/v1/deals/${dealId}/messages`)
          .query({ limit: 2, ...(cursor ? { cursor } : {}) }),
      ).expect(200);

      seen.push(...response.body.data.messages.map((m: { id: string }) => m.id));
      cursor = response.body.data.nextCursor ?? undefined;
    } while (cursor);

    expect(seen).toHaveLength(5);
    expect(new Set(seen).size).toBe(5);
  });
});

describe("exchange competing proposals", () => {
  it("rejects a competing proposal touching an offered listing", async () => {
    const { seller, buyer, listing, offered } = await swapSetup();
    const anotherBuyer = await registerUser(app);
    await prisma.user.update({
      where: { id: anotherBuyer.id },
      data: { emailVerifiedAt: new Date() },
    });

    // Another buyer makes a sale proposal on one of the listings our buyer
    // wants to offer. Make it sale-capable first (offered items are EXCHANGE).
    await prisma.listing.update({
      where: { id: offered[0]!.id },
      data: { listingType: "BOTH" },
    });
    const competing = await propose(
      anotherBuyer.accessToken,
      offered[0]!.id,
    ).expect(201);

    const deal = await exchange(
      buyer.accessToken,
      listing.id,
      offered.map((item) => item.id),
    ).expect(201);

    await auth(seller.accessToken)(
      request(app)
        .post(`/api/v1/deals/${deal.body.data.deal.id}/accept`)
        .set("Origin", "http://localhost:3000"),
    ).expect(200);

    const competitor = await prisma.deal.findUnique({
      where: { id: competing.body.data.deal.id },
    });
    expect(competitor?.status).toBe("REJECTED");
  });
});
