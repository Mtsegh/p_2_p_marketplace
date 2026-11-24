import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { prisma } from "../src/db/prisma.js";
import { signWebhookBody } from "../src/modules/payments/webhook-signature.js";
import { createAdmin, registerUser, resetIdentityState } from "./helpers.js";

const app = createApp();

beforeEach(async () => {
  await resetIdentityState();
});

function auth(token: string) {
  return (req: request.Test) => req.set("Authorization", `Bearer ${token}`);
}

/** A verified seller with payout onboarding, and a verified buyer. */
async function members() {
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

  return { seller, buyer };
}

async function activeListing(ownerId: string, type: "SALE" | "BOTH" = "SALE") {
  // Created directly: listing CRUD is covered in listings.test.ts, while this
  // suite covers the sequential deal/payment/handoff flow.
  return prisma.listing.create({
    data: {
      ownerId,
      title: "E2E item",
      description: "End-to-end flow item",
      location: "Lagos",
      status: "ACTIVE",
      priceCents: 10000,
      listingType: type,
    },
  });
}

function propose(buyerToken: string, listingId: string, amountCents = 10000) {
  return auth(buyerToken)(
    request(app)
      .post("/api/v1/deals")
      .set("Origin", "http://localhost:3000")
      .send({ listingId, amountCents }),
  );
}

/** Secures funds for an accepted deal via checkout + a signed webhook. */
async function secureFunds(buyerToken: string, dealId: string) {
  await auth(buyerToken)(
    request(app)
      .post("/api/v1/payments/checkout")
      .set("Origin", "http://localhost:3000")
      .send({ dealId }),
  ).expect(201);

  const tx = (await prisma.transaction.findFirst({ where: { dealId } }))!;
  const payload = {
    id: `evt_e2e_${dealId}`,
    type: "payment.succeeded",
    data: { providerPaymentId: tx.providerPaymentId },
  };

  await request(app)
    .post("/api/v1/payments/webhook")
    .set("Content-Type", "application/json")
    .set("x-webhook-signature", signWebhookBody(JSON.stringify(payload)))
    .send(JSON.stringify(payload))
    .expect(200);

  return tx;
}

describe("E2E: sale with escrow, handoff and review", () => {
  it("runs the full happy path in order", async () => {
    const { seller, buyer } = await members();
    const listing = await activeListing(seller.id);

    // 1. Proposal
    const proposal = await propose(buyer.accessToken, listing.id).expect(201);
    const dealId = proposal.body.data.deal.id;
    expect(proposal.body.data.deal.status).toBe("PROPOSED");

    // 2. Acceptance reserves the listing
    await auth(seller.accessToken)(
      request(app)
        .post(`/api/v1/deals/${dealId}/accept`)
        .set("Origin", "http://localhost:3000"),
    ).expect(200);
    expect(
      (await prisma.listing.findUnique({ where: { id: listing.id } }))?.status,
    ).toBe("RESERVED");

    // 3. Escrow secures the funds
    const tx = await secureFunds(buyer.accessToken, dealId);
    const secured = await auth(buyer.accessToken)(
      request(app).get(`/api/v1/deals/${dealId}`),
    ).expect(200);
    expect(secured.body.data.deal.status).toBe("PAYMENT_PENDING");
    expect(secured.body.data.deal.escrowExpiresAt).not.toBeNull();
    expect(
      await prisma.ledgerEntry.count({
        where: { transactionId: tx.id, type: "HOLD" },
      }),
    ).toBe(1);

    // 4. Handoff: buyer reveals, seller completes
    const revealed = await auth(buyer.accessToken)(
      request(app)
        .post(`/api/v1/deals/${dealId}/handoff/reveal`)
        .set("Origin", "http://localhost:3000"),
    ).expect(200);
    await auth(seller.accessToken)(
      request(app)
        .post(`/api/v1/deals/${dealId}/handoff/complete`)
        .set("Origin", "http://localhost:3000")
        .send({ code: revealed.body.data.code }),
    ).expect(200);

    expect(
      (await prisma.deal.findUnique({ where: { id: dealId } }))?.status,
    ).toBe("COMPLETED");
    expect(
      await prisma.ledgerEntry.count({
        where: { transactionId: tx.id, type: "PAYOUT" },
      }),
    ).toBe(1);

    // 5. A two-way review after completion
    await auth(buyer.accessToken)(
      request(app)
        .post("/api/v1/reviews")
        .set("Origin", "http://localhost:3000")
        .send({ dealId, rating: 5, comment: "Smooth trade" }),
    ).expect(201);
    await auth(seller.accessToken)(
      request(app)
        .post("/api/v1/reviews")
        .set("Origin", "http://localhost:3000")
        .send({ dealId, rating: 4 }),
    ).expect(201);

    const trust = await request(app)
      .get(`/api/v1/reviews/trust?userId=${seller.id}`)
      .expect(200);
    expect(trust.body.data.reviewCount).toBe(1);
    // The buyer reviewed the seller with 5 stars; the seller's 4-star review
    // was about the buyer, so the seller's average is 5.
    expect(trust.body.data.averageRating).toBe(5);
  });

  it("rejects a wrong code, then completes with the correct one", async () => {
    const { seller, buyer } = await members();
    const listing = await activeListing(seller.id);
    const proposal = await propose(buyer.accessToken, listing.id).expect(201);
    const dealId = proposal.body.data.deal.id;

    await auth(seller.accessToken)(
      request(app)
        .post(`/api/v1/deals/${dealId}/accept`)
        .set("Origin", "http://localhost:3000"),
    ).expect(200);
    await secureFunds(buyer.accessToken, dealId);

    const revealed = await auth(buyer.accessToken)(
      request(app)
        .post(`/api/v1/deals/${dealId}/handoff/reveal`)
        .set("Origin", "http://localhost:3000"),
    ).expect(200);

    await auth(seller.accessToken)(
      request(app)
        .post(`/api/v1/deals/${dealId}/handoff/complete`)
        .set("Origin", "http://localhost:3000")
        .send({ code: "111 111" }),
    ).expect(400);
    expect(
      (await prisma.deal.findUnique({ where: { id: dealId } }))?.status,
    ).toBe("PAYMENT_PENDING");

    await auth(seller.accessToken)(
      request(app)
        .post(`/api/v1/deals/${dealId}/handoff/complete`)
        .set("Origin", "http://localhost:3000")
        .send({ code: revealed.body.data.code }),
    ).expect(200);
    expect(
      (await prisma.deal.findUnique({ where: { id: dealId } }))?.status,
    ).toBe("COMPLETED");
  });

  it("a replayed webhook does not double-secure funds", async () => {
    const { seller, buyer } = await members();
    const listing = await activeListing(seller.id);
    const proposal = await propose(buyer.accessToken, listing.id).expect(201);
    const dealId = proposal.body.data.deal.id;

    await auth(seller.accessToken)(
      request(app)
        .post(`/api/v1/deals/${dealId}/accept`)
        .set("Origin", "http://localhost:3000"),
    ).expect(200);
    await auth(buyer.accessToken)(
      request(app)
        .post("/api/v1/payments/checkout")
        .set("Origin", "http://localhost:3000")
        .send({ dealId }),
    ).expect(201);

    const txRow = (await prisma.transaction.findFirst({ where: { dealId } }))!;
    const payload = {
      id: `evt_e2e_replay_${dealId}`,
      type: "payment.succeeded",
      data: { providerPaymentId: txRow.providerPaymentId },
    };
    const signature = signWebhookBody(JSON.stringify(payload));

    const send = () =>
      request(app)
        .post("/api/v1/payments/webhook")
        .set("Content-Type", "application/json")
        .set("x-webhook-signature", signature)
        .send(JSON.stringify(payload));

    const first = await send().expect(200);
    const second = await send().expect(200);
    const third = await send().expect(200);

    expect(first.body.data.changed).toBe(true);
    expect(second.body.data.alreadyProcessed).toBe(true);
    expect(second.body.data.changed).toBe(false);
    expect(third.body.data.alreadyProcessed).toBe(true);
    expect(
      await prisma.ledgerEntry.count({
        where: { transactionId: txRow.id, type: "HOLD" },
      }),
    ).toBe(1);
  });
});

describe("E2E: dispute resolution", () => {
  it("freezes funds and refunds the buyer via admin resolution", async () => {
    const { seller, buyer } = await members();
    const admin = await createAdmin(app);
    const listing = await activeListing(seller.id);
    const proposal = await propose(buyer.accessToken, listing.id).expect(201);
    const dealId = proposal.body.data.deal.id;

    await auth(seller.accessToken)(
      request(app)
        .post(`/api/v1/deals/${dealId}/accept`)
        .set("Origin", "http://localhost:3000"),
    ).expect(200);
    await secureFunds(buyer.accessToken, dealId);

    const dispute = await auth(buyer.accessToken)(
      request(app)
        .post("/api/v1/disputes")
        .set("Origin", "http://localhost:3000")
        .send({ dealId, reason: "Item was not as described" }),
    ).expect(201);
    expect(dispute.body.data.dispute.status).toBe("OPEN");
    expect(
      (await prisma.deal.findUnique({ where: { id: dealId } }))?.status,
    ).toBe("DISPUTED");

    const resolved = await auth(admin.accessToken)(
      request(app)
        .patch(`/api/v1/disputes/${dispute.body.data.dispute.id}/resolve`)
        .set("Origin", "http://localhost:3000")
        .send({ resolution: "REFUND", note: "Admin sided with buyer" }),
    ).expect(200);
    expect(resolved.body.data.dispute.resolution).toBe("REFUND");
    expect(
      (await prisma.deal.findUnique({ where: { id: dealId } }))?.status,
    ).toBe("RESOLVED");
  });
});

describe("E2E: exchange swap with dual confirmation", () => {
  it("completes only after both parties confirm", async () => {
    const { seller, buyer } = await members();
    const target = await prisma.listing.create({
      data: {
        ownerId: seller.id,
        title: "Wanted item",
        description: "x",
        location: "Lagos",
        status: "ACTIVE",
        listingType: "BOTH",
      },
    });
    const offered = await prisma.listing.create({
      data: {
        ownerId: buyer.id,
        title: "Offered item",
        description: "x",
        location: "Lagos",
        status: "ACTIVE",
        listingType: "EXCHANGE",
      },
    });

    const proposal = await auth(buyer.accessToken)(
      request(app)
        .post("/api/v1/deals/exchange")
        .set("Origin", "http://localhost:3000")
        .send({ listingId: target.id, offeredListingIds: [offered.id] }),
    ).expect(201);
    const dealId = proposal.body.data.deal.id;

    await auth(seller.accessToken)(
      request(app)
        .post(`/api/v1/deals/${dealId}/accept`)
        .set("Origin", "http://localhost:3000"),
    ).expect(200);

    const statuses = await prisma.listing.findMany({
      where: { id: { in: [target.id, offered.id] } },
      select: { status: true },
    });
    expect(statuses.every((item) => item.status === "RESERVED")).toBe(true);

    const first = await auth(buyer.accessToken)(
      request(app)
        .post(`/api/v1/deals/${dealId}/handoff/confirm`)
        .set("Origin", "http://localhost:3000"),
    ).expect(200);
    expect(first.body.data.completed).toBe(false);

    const second = await auth(seller.accessToken)(
      request(app)
        .post(`/api/v1/deals/${dealId}/handoff/confirm`)
        .set("Origin", "http://localhost:3000"),
    ).expect(200);
    expect(second.body.data.completed).toBe(true);
    expect(
      (await prisma.deal.findUnique({ where: { id: dealId } }))?.status,
    ).toBe("COMPLETED");
  });
});
