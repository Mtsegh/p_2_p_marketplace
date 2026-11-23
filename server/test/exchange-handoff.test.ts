import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { prisma } from "../src/db/prisma.js";
import { registerUser, resetIdentityState } from "./helpers.js";

const app = createApp();

beforeEach(async () => {
  await resetIdentityState();
});

function auth(token: string) {
  return (req: request.Test) => req.set("Authorization", `Bearer ${token}`);
}

/** Sets up two buyers, a seller, and an accepted exchange (no cash top-up). */
async function exchangeSetup() {
  const seller = await registerUser(app);
  const buyer = await registerUser(app);

  await prisma.user.updateMany({
    where: { id: { in: [seller.id, buyer.id] } },
    data: { emailVerifiedAt: new Date() },
  });

  const sellerListing = await prisma.listing.create({
    data: {
      ownerId: seller.id,
      title: "Seller's item",
      description: "Wanted",
      location: "Lagos",
      status: "ACTIVE",
      listingType: "BOTH",
    },
  });
  const buyerListing = await prisma.listing.create({
    data: {
      ownerId: buyer.id,
      title: "Buyer's item",
      description: "Offered in swap",
      location: "Lagos",
      status: "ACTIVE",
      listingType: "EXCHANGE",
    },
  });

  const result = await auth(buyer.accessToken)(
    request(app)
      .post("/api/v1/deals/exchange")
      .set("Origin", "http://localhost:3000")
      .send({ listingId: sellerListing.id, offeredListingIds: [buyerListing.id] }),
  ).expect(201);

  const dealId = result.body.data.deal.id;

  await auth(seller.accessToken)(
    request(app)
      .post(`/api/v1/deals/${dealId}/accept`)
      .set("Origin", "http://localhost:3000"),
  ).expect(200);

  return { seller, buyer, dealId, sellerListing, buyerListing };
}

function confirm(token: string, dealId: string) {
  return auth(token)(
    request(app)
      .post(`/api/v1/deals/${dealId}/handoff/confirm`)
      .set("Origin", "http://localhost:3000"),
  );
}

describe("exchange dual-lock handoff", () => {
  it("moves an accepted pure exchange into the handoff phase", async () => {
    const { dealId } = await exchangeSetup();

    const deal = await prisma.deal.findUnique({ where: { id: dealId } });
    expect(deal?.status).toBe("PAYMENT_PENDING");
    expect(deal?.escrowExpiresAt).not.toBeNull();
  });

  it("one-sided confirmation leaves the deal pending", async () => {
    const { buyer, dealId } = await exchangeSetup();

    const result = await confirm(buyer.accessToken, dealId).expect(200);
    expect(result.body.data.completed).toBe(false);
    expect(result.body.data.status).toBe("PAYMENT_PENDING");
    expect(result.body.data.buyerConfirmedAt).not.toBeNull();
    expect(result.body.data.sellerConfirmedAt).toBeNull();

    const deal = await prisma.deal.findUnique({ where: { id: dealId } });
    expect(deal?.status).toBe("PAYMENT_PENDING");
  });

  it("completes only after both parties confirm", async () => {
    const { buyer, seller, dealId } = await exchangeSetup();

    await confirm(buyer.accessToken, dealId).expect(200);
    const second = await confirm(seller.accessToken, dealId).expect(200);

    expect(second.body.data.completed).toBe(true);
    expect(second.body.data.status).toBe("COMPLETED");
    expect(second.body.data.buyerConfirmedAt).not.toBeNull();
    expect(second.body.data.sellerConfirmedAt).not.toBeNull();

    const deal = await prisma.deal.findUnique({ where: { id: dealId } });
    expect(deal?.status).toBe("COMPLETED");
    expect(deal?.completedAt).not.toBeNull();
  });

  it("a repeat confirmation from the same party is a no-op", async () => {
    const { buyer, dealId } = await exchangeSetup();

    await confirm(buyer.accessToken, dealId).expect(200);
    const again = await confirm(buyer.accessToken, dealId).expect(200);
    expect(again.body.data.completed).toBe(false);
  });

  it("rejects a stranger's confirmation", async () => {
    const { dealId } = await exchangeSetup();
    const stranger = await registerUser(app);

    await confirm(stranger.accessToken, dealId).expect(403);
  });

  it("rejects confirmation on a sale deal", async () => {
    const seller = await registerUser(app);
    const buyer = await registerUser(app);
    await prisma.user.updateMany({
      where: { id: { in: [seller.id, buyer.id] } },
      data: { emailVerifiedAt: new Date() },
    });
    await prisma.user.update({
      where: { id: seller.id },
      data: {
        payoutOnboardedAt: new Date(),
        payoutAccountId: `test_acct_${seller.id}`,
      },
    });
    const listing = await prisma.listing.create({
      data: {
        ownerId: seller.id,
        title: "Sale item",
        description: "x",
        location: "Lagos",
        status: "ACTIVE",
        priceCents: 5000,
      },
    });
    const result = await auth(buyer.accessToken)(
      request(app)
        .post("/api/v1/deals")
        .set("Origin", "http://localhost:3000")
        .send({ listingId: listing.id, amountCents: 5000 }),
    ).expect(201);

    await auth(seller.accessToken)(
      request(app)
        .post(`/api/v1/deals/${result.body.data.deal.id}/accept`)
        .set("Origin", "http://localhost:3000"),
    ).expect(200);

    await confirm(buyer.accessToken, result.body.data.deal.id).expect(422);
  });
});
