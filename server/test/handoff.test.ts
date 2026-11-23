import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { prisma } from "../src/db/prisma.js";
import { env } from "../src/config/env.js";
import { signWebhookBody } from "../src/modules/payments/webhook-signature.js";
import { registerUser, resetIdentityState } from "./helpers.js";

const app = createApp();

beforeEach(async () => {
  await resetIdentityState();
});

function auth(token: string) {
  return (req: request.Test) => req.set("Authorization", `Bearer ${token}`);
}

/** Sets up a secured (PAYMENT_PENDING) sale deal with a HOLD ledger entry. */
async function securedDeal() {
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
      title: "Handoff camera",
      description: "For handoff tests",
      location: "Lagos",
      status: "RESERVED",
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
      history: { create: { fromStatus: "PROPOSED", toStatus: "ACCEPTED" } },
    },
  });

  await auth(buyer.accessToken)(
    request(app)
      .post("/api/v1/payments/checkout")
      .set("Origin", "http://localhost:3000")
      .send({ dealId: deal.id }),
  ).expect(201);

  const tx = await prisma.transaction.findFirst({ where: { dealId: deal.id } });
  const payload = {
    id: `evt_handoff_${deal.id}`,
    type: "payment.succeeded",
    data: { providerPaymentId: tx!.providerPaymentId },
  };
  const signature = signWebhookBody(JSON.stringify(payload));
  await request(app)
    .post("/api/v1/payments/webhook")
    .set("Content-Type", "application/json")
    .set("x-webhook-signature", signature)
    .send(JSON.stringify(payload))
    .expect(200);

  return { seller, buyer, deal, tx: tx! };
}

describe("handoff code", () => {
  it("lets the buyer reveal a code and the seller complete with it", async () => {
    const { seller, buyer, deal, tx } = await securedDeal();

    const revealed = await auth(buyer.accessToken)(
      request(app)
        .post(`/api/v1/deals/${deal.id}/handoff/reveal`)
        .set("Origin", "http://localhost:3000"),
    ).expect(200);
    expect(revealed.body.data.code).toMatch(/^\d{3} \d{3}$/);

    // Only a hash is stored.
    const stored = await prisma.deal.findUnique({ where: { id: deal.id } });
    expect(stored?.handoffCodeHash).not.toBe(revealed.body.data.code);
    expect(stored?.handoffCodeHash).toMatch(/^[a-f0-9]{64}$/);

    const completed = await auth(seller.accessToken)(
      request(app)
        .post(`/api/v1/deals/${deal.id}/handoff/complete`)
        .set("Origin", "http://localhost:3000")
        .send({ code: revealed.body.data.code }),
    ).expect(200);
    expect(completed.body.data.status).toBe("COMPLETED");

    const finalDeal = await prisma.deal.findUnique({ where: { id: deal.id } });
    expect(finalDeal?.status).toBe("COMPLETED");
    expect(finalDeal?.completedAt).not.toBeNull();
    expect(finalDeal?.handoffCodeHash).toBeNull();

    const payout = await prisma.ledgerEntry.findFirst({
      where: { transactionId: tx.id, type: "PAYOUT" },
    });
    expect(payout?.amountCents).toBe(tx.amountCents - tx.feeCents);
  });

  it("rejects a wrong code and counts attempts", async () => {
    const { seller, buyer, deal } = await securedDeal();

    await auth(buyer.accessToken)(
      request(app)
        .post(`/api/v1/deals/${deal.id}/handoff/reveal`)
        .set("Origin", "http://localhost:3000"),
    ).expect(200);

    await auth(seller.accessToken)(
      request(app)
        .post(`/api/v1/deals/${deal.id}/handoff/complete`)
        .set("Origin", "http://localhost:3000")
        .send({ code: "000 000" }),
    ).expect(400);

    const stored = await prisma.deal.findUnique({ where: { id: deal.id } });
    expect(stored?.handoffAttempts).toBe(1);
    expect(stored?.status).toBe("PAYMENT_PENDING");
  });

  it("voids the code after the attempt limit", async () => {
    const { seller, buyer, deal } = await securedDeal();

    await auth(buyer.accessToken)(
      request(app)
        .post(`/api/v1/deals/${deal.id}/handoff/reveal`)
        .set("Origin", "http://localhost:3000"),
    ).expect(200);

    for (let i = 0; i < env.HANDOFF_MAX_ATTEMPTS; i += 1) {
      await auth(seller.accessToken)(
        request(app)
          .post(`/api/v1/deals/${deal.id}/handoff/complete`)
          .set("Origin", "http://localhost:3000")
          .send({ code: "000 000" }),
      ).expect(400);
    }

    await auth(seller.accessToken)(
      request(app)
        .post(`/api/v1/deals/${deal.id}/handoff/complete`)
        .set("Origin", "http://localhost:3000")
        .send({ code: "000 000" }),
    ).expect(429);
  });

  it("does not let the seller reveal or the buyer complete", async () => {
    const { seller, buyer, deal } = await securedDeal();

    await auth(seller.accessToken)(
      request(app)
        .post(`/api/v1/deals/${deal.id}/handoff/reveal`)
        .set("Origin", "http://localhost:3000"),
    ).expect(403);

    await auth(buyer.accessToken)(
      request(app)
        .post(`/api/v1/deals/${deal.id}/handoff/complete`)
        .set("Origin", "http://localhost:3000")
        .send({ code: "123 456" }),
    ).expect(403);
  });

  it("rejects an expired code", async () => {
    const { seller, buyer, deal } = await securedDeal();

    const revealed = await auth(buyer.accessToken)(
      request(app)
        .post(`/api/v1/deals/${deal.id}/handoff/reveal`)
        .set("Origin", "http://localhost:3000"),
    ).expect(200);

    await prisma.deal.update({
      where: { id: deal.id },
      data: { handoffCodeExpiresAt: new Date(Date.now() - 1000) },
    });

    await auth(seller.accessToken)(
      request(app)
        .post(`/api/v1/deals/${deal.id}/handoff/complete`)
        .set("Origin", "http://localhost:3000")
        .send({ code: revealed.body.data.code }),
    ).expect(410);
  });
});
