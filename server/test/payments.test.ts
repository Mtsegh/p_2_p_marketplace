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
  return (req: request.Test) =>
    req.set("Authorization", `Bearer ${token}`);
}

/** Sets up a verified seller/buyer, an active listing, and an ACCEPTED deal. */
async function paidDealSetup() {
  const seller = await registerUser(app);
  const buyer = await registerUser(app);

  await prisma.user.updateMany({
    where: { id: { in: [seller.id, buyer.id] } },
    data: { emailVerifiedAt: new Date() },
  });

  const listing = await prisma.listing.create({
    data: {
      ownerId: seller.id,
      title: "Payment test camera",
      description: "For payment tests",
      location: "Lagos",
      status: "ACTIVE",
      priceCents: 10000,
    },
  });

  const deal = await prisma.deal.create({
    data: {
      listingId: listing.id,
      buyerId: buyer.id,
      sellerId: seller.id,
      amountCents: 10000,
      type: "SALE",
      status: "ACCEPTED",
      history: {
        create: { fromStatus: "PROPOSED", toStatus: "ACCEPTED" },
      },
    },
  });

  await prisma.listing.update({
    where: { id: listing.id },
    data: { status: "RESERVED" },
  });

  return { seller, buyer, listing, deal };
}

describe("POST /api/v1/payments/checkout", () => {
  it("creates a pending transaction and a checkout URL", async () => {
    const { buyer, deal } = await paidDealSetup();

    const response = await auth(buyer.accessToken)(
      request(app)
        .post("/api/v1/payments/checkout")
        .set("Origin", "http://localhost:3000")
        .send({ dealId: deal.id }),
    ).expect(201);

    expect(response.body.data.checkoutUrl).toContain("checkout.test");
    expect(response.body.data.amountCents).toBe(10000);

    const tx = await prisma.transaction.findFirst({ where: { dealId: deal.id } });
    expect(tx?.status).toBe("PENDING");
    expect(tx?.providerPaymentId).toContain(deal.id);
  });

  it("is idempotent on retry", async () => {
    const { buyer, deal } = await paidDealSetup();
    const body = { dealId: deal.id };

    const first = await auth(buyer.accessToken)(
      request(app)
        .post("/api/v1/payments/checkout")
        .set("Origin", "http://localhost:3000")
        .send(body),
    ).expect(201);

    const second = await auth(buyer.accessToken)(
      request(app)
        .post("/api/v1/payments/checkout")
        .set("Origin", "http://localhost:3000")
        .send(body),
    ).expect(201);

    expect(second.body.data.checkoutUrl).toBe(first.body.data.checkoutUrl);
    const count = await prisma.transaction.count({ where: { dealId: deal.id } });
    expect(count).toBe(1);
  });

  it("rejects a non-buyer", async () => {
    const { seller, deal } = await paidDealSetup();

    await auth(seller.accessToken)(
      request(app)
        .post("/api/v1/payments/checkout")
        .set("Origin", "http://localhost:3000")
        .send({ dealId: deal.id }),
    ).expect(403);
  });
});

describe("POST /api/v1/payments/webhook", () => {
  function webhookBody(eventId: string, paymentId: string) {
    return {
      id: eventId,
      type: "payment.succeeded",
      data: { providerPaymentId: paymentId },
    };
  }

  function postWebhook(payload: object, signature?: string) {
    const req = request(app)
      .post("/api/v1/payments/webhook")
      .set("Content-Type", "application/json");

    if (signature !== undefined) {
      req.set("x-webhook-signature", signature);
    }

    return req.send(JSON.stringify(payload));
  }

  it("rejects a missing or invalid signature", async () => {
    const payload = webhookBody("evt_1", "test_pay_1");

    await postWebhook(payload).expect(401);
    await postWebhook(payload, "bad-signature").expect(401);
  });

  it("marks the transaction succeeded and moves the deal to PAYMENT_PENDING", async () => {
    const { buyer, deal } = await paidDealSetup();

    await auth(buyer.accessToken)(
      request(app)
        .post("/api/v1/payments/checkout")
        .set("Origin", "http://localhost:3000")
        .send({ dealId: deal.id }),
    ).expect(201);

    const tx = await prisma.transaction.findFirst({ where: { dealId: deal.id } });
    const payload = webhookBody("evt_success_1", tx!.providerPaymentId);
    const signature = signWebhookBody(JSON.stringify(payload));

    const response = await postWebhook(payload, signature).expect(200);
    expect(response.body.data.changed).toBe(true);

    const updatedTx = await prisma.transaction.findUnique({ where: { id: tx!.id } });
    expect(updatedTx?.status).toBe("SUCCEEDED");

    const updatedDeal = await prisma.deal.findUnique({ where: { id: deal.id } });
    expect(updatedDeal?.status).toBe("PAYMENT_PENDING");
  });

  it("is idempotent: a replayed event changes nothing", async () => {
    const { buyer, deal } = await paidDealSetup();

    await auth(buyer.accessToken)(
      request(app)
        .post("/api/v1/payments/checkout")
        .set("Origin", "http://localhost:3000")
        .send({ dealId: deal.id }),
    ).expect(201);

    const tx = await prisma.transaction.findFirst({ where: { dealId: deal.id } });
    const payload = webhookBody("evt_replay", tx!.providerPaymentId);
    const signature = signWebhookBody(JSON.stringify(payload));

    const first = await postWebhook(payload, signature).expect(200);
    const second = await postWebhook(payload, signature).expect(200);

    expect(first.body.data.changed).toBe(true);
    expect(second.body.data.alreadyProcessed).toBe(true);
    expect(second.body.data.changed).toBe(false);

    const eventCount = await prisma.webhookEvent.count({
      where: { providerEventId: "evt_replay" },
    });
    expect(eventCount).toBe(1);
  });

  it("rejects a malformed payload", async () => {
    const payload = { id: "evt_bad", type: "unknown", data: {} };
    const signature = signWebhookBody(JSON.stringify(payload));

    await postWebhook(payload, signature).expect(422);
  });
});
