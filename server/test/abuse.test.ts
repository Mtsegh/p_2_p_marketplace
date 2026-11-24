import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { prisma } from "../src/db/prisma.js";
import { signWebhookBody } from "../src/modules/payments/webhook-signature.js";
import { registerUser, resetIdentityState } from "./helpers.js";

const app = createApp();

beforeEach(async () => {
  await resetIdentityState();
});

function auth(token: string) {
  return (req: request.Test) => req.set("Authorization", `Bearer ${token}`);
}

async function verifiedSellerAndBuyer() {
  const seller = await registerUser(app);
  const buyer = await registerUser(app);

  await prisma.user.updateMany({
    where: { id: { in: [seller.id, buyer.id] } },
    data: { emailVerifiedAt: new Date() },
  });

  const listing = await prisma.listing.create({
    data: {
      ownerId: seller.id,
      title: "Abuse target",
      description: "x",
      location: "Lagos",
      status: "ACTIVE",
      priceCents: 5000,
    },
  });

  return { seller, buyer, listing };
}

describe("abuse protection: search rate limit", () => {
  it("bounds the public listings endpoint per IP", async () => {
    // The limiter allows 120 requests / 15 min. Burn through the bucket and
    // confirm the next search is rejected with 429 + Retry-After.
    let limited = false;

    for (let i = 0; i < 130; i += 1) {
      const response = await request(app).get("/api/v1/listings?limit=5");

      if (response.status === 429) {
        limited = true;
        expect(response.headers["retry-after"]).toBeDefined();
        break;
      }
    }

    expect(limited).toBe(true);
  });
});

describe("abuse protection: proposal rate limit", () => {
  it("bounds proposal creation per user", async () => {
    const { buyer } = await verifiedSellerAndBuyer();
    const owner = await registerUser(app);

    // Many distinct target listings so P2002 (duplicate proposal) cannot mask
    // a rate-limit response. All belong to a different user than the proposer.
    const listings = await prisma.listing.createManyAndReturn({
      data: Array.from({ length: 25 }).map((_, i) => ({
        ownerId: owner.id,
        title: `Target ${i}`,
        description: "x",
        location: "Lagos",
        status: "ACTIVE",
      })),
    });

    let limited = false;

    for (const listing of listings) {
      const response = await auth(buyer.accessToken)(
        request(app)
          .post("/api/v1/deals")
          .set("Origin", "http://localhost:3000")
          .send({ listingId: listing.id, amountCents: 1000 }),
      );

      if (response.status === 429) {
        limited = true;
        break;
      }
    }

    expect(limited).toBe(true);
  });
});

describe("abuse protection: webhook signature", () => {
  it("rejects a body that was tampered with after signing", async () => {
    const original = {
      id: "evt_tampered",
      type: "payment.succeeded",
      data: { providerPaymentId: "test_pay_x" },
    };
    const signature = signWebhookBody(JSON.stringify(original));
    const tampered = {
      ...original,
      data: { providerPaymentId: "test_pay_attacker" },
    };

    await request(app)
      .post("/api/v1/payments/webhook")
      .set("Content-Type", "application/json")
      .set("x-webhook-signature", signature)
      .send(JSON.stringify(tampered))
      .expect(401);

    const events = await prisma.webhookEvent.count({
      where: { providerEventId: "evt_tampered" },
    });
    expect(events).toBe(0);
  });
});

describe("abuse protection: handoff code", () => {
  it("does not accept a correct code after the attempt limit is spent", async () => {
    const seller = await registerUser(app);
    const buyer = await registerUser(app);

    await prisma.user.updateMany({
      where: { id: { in: [seller.id, buyer.id] } },
      data: { emailVerifiedAt: new Date() },
    });

    const listing = await prisma.listing.create({
      data: {
        ownerId: seller.id,
        title: "Lockout target",
        description: "x",
        location: "Lagos",
        status: "RESERVED",
        priceCents: 5000,
      },
    });

    const deal = await prisma.deal.create({
      data: {
        listingId: listing.id,
        buyerId: buyer.id,
        sellerId: seller.id,
        amountCents: 5000,
        type: "SALE",
        status: "PAYMENT_PENDING",
        escrowExpiresAt: new Date(Date.now() + 86_400_000),
      },
    });

    // Reveal a real code, then spend all attempts with wrong values.
    const revealed = await auth(buyer.accessToken)(
      request(app)
        .post(`/api/v1/deals/${deal.id}/handoff/reveal`)
        .set("Origin", "http://localhost:3000"),
    ).expect(200);

    for (let i = 0; i < 5; i += 1) {
      await auth(seller.accessToken)(
        request(app)
          .post(`/api/v1/deals/${deal.id}/handoff/complete`)
          .set("Origin", "http://localhost:3000")
          .send({ code: "000 000" }),
      ).expect(400);
    }

    // The correct code must still be refused once lockout is reached.
    await auth(seller.accessToken)(
      request(app)
        .post(`/api/v1/deals/${deal.id}/handoff/complete`)
        .set("Origin", "http://localhost:3000")
        .send({ code: revealed.body.data.code }),
    ).expect(429);

    const final = await prisma.deal.findUnique({ where: { id: deal.id } });
    expect(final?.status).toBe("PAYMENT_PENDING");
  });
});
