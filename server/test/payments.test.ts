import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { prisma } from "../src/db/prisma.js";
import { signWebhookBody } from "../src/modules/payments/webhook-signature.js";
import { env } from "../src/config/env.js";
import { registerUser, resetIdentityState } from "./helpers.js";

const app = createApp();

beforeEach(async () => {
  await resetIdentityState();
});

function auth(token: string) {
  return (req: request.Test) =>
    req.set("Authorization", `Bearer ${token}`);
}

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

describe("payout onboarding", () => {
  it("onboards a seller and reports status without leaking the account id", async () => {
    const seller = await registerUser(app);
    const authSeller = auth(seller.accessToken);

    const before = await authSeller(
      request(app).get("/api/v1/payments/payout/status"),
    ).expect(200);
    expect(before.body.data.onboarded).toBe(false);

    const response = await authSeller(
      request(app)
        .post("/api/v1/payments/payout/onboard")
        .set("Origin", "http://localhost:3000")
        .send({ country: "us" }),
    ).expect(200);
    expect(response.body.data.onboarded).toBe(true);

    const after = await authSeller(
      request(app).get("/api/v1/payments/payout/status"),
    ).expect(200);
    expect(after.body.data.onboarded).toBe(true);
    expect(JSON.stringify(after.body)).not.toContain("test_acct");
  });

  it("validates the country code", async () => {
    const seller = await registerUser(app);

    await auth(seller.accessToken)(
      request(app)
        .post("/api/v1/payments/payout/onboard")
        .set("Origin", "http://localhost:3000")
        .send({ country: "USA" }),
    ).expect(422);
  });
});

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

describe("escrow hold", () => {
  async function securedDeal() {
    const { buyer, deal } = await paidDealSetup();

    await auth(buyer.accessToken)(
      request(app)
        .post("/api/v1/payments/checkout")
        .set("Origin", "http://localhost:3000")
        .send({ dealId: deal.id }),
    ).expect(201);

    const tx = await prisma.transaction.findFirst({ where: { dealId: deal.id } });
    const payload = {
      id: `evt_escrow_${deal.id}`,
      type: "payment.succeeded",
      data: { providerPaymentId: tx!.providerPaymentId },
    };
    const signature = signWebhookBody(JSON.stringify(payload));
    await postWebhook(payload, signature).expect(200);

    return { buyer, deal, tx: tx! };
  }

  it("sets an escrow deadline and a HOLD ledger entry on payment success", async () => {
    const { deal, tx } = await securedDeal();

    const updated = await prisma.deal.findUnique({ where: { id: deal.id } });
    expect(updated?.status).toBe("PAYMENT_PENDING");
    expect(updated?.escrowExpiresAt).not.toBeNull();

    const hold = await prisma.ledgerEntry.findFirst({
      where: { transactionId: tx.id, type: "HOLD" },
    });
    expect(hold).not.toBeNull();
    expect(hold?.amountCents).toBe(tx.amountCents - tx.feeCents);
  });

  it("exposes escrowExpiresAt on the deal detail", async () => {
    const { buyer, deal } = await securedDeal();

    const response = await auth(buyer.accessToken)(
      request(app).get(`/api/v1/deals/${deal.id}`),
    ).expect(200);
    expect(response.body.data.deal.escrowExpiresAt).not.toBeNull();
  });

  it("refunds an expired escrow automatically and is idempotent", async () => {
    const { deal, tx } = await securedDeal();

    // Force the deadline into the past.
    await prisma.deal.update({
      where: { id: deal.id },
      data: { escrowExpiresAt: new Date(Date.now() - 1000) },
    });

    const first = await request(app)
      .post("/api/v1/payments/escrow/process-expired")
      .set("x-cron-secret", env.CRON_SECRET)
      .expect(200);
    expect(first.body.data.processed).toBeGreaterThanOrEqual(1);

    const updated = await prisma.deal.findUnique({ where: { id: deal.id } });
    expect(updated?.status).toBe("CANCELLED");

    const updatedTx = await prisma.transaction.findUnique({ where: { id: tx.id } });
    expect(updatedTx?.status).toBe("REFUNDED");

    const refund = await prisma.ledgerEntry.findFirst({
      where: { transactionId: tx.id, type: "REFUND" },
    });
    expect(refund?.amountCents).toBe(tx.amountCents);

    // A second run must not double-refund or reprocess.
    const second = await request(app)
      .post("/api/v1/payments/escrow/process-expired")
      .set("x-cron-secret", env.CRON_SECRET)
      .expect(200);
    expect(second.body.data.processed).toBe(0);

    const refundCount = await prisma.ledgerEntry.count({
      where: { transactionId: tx.id, type: "REFUND" },
    });
    expect(refundCount).toBe(1);
  });

  it("rejects the processor without the cron secret", async () => {
    await request(app)
      .post("/api/v1/payments/escrow/process-expired")
      .expect(401);
  });
});
