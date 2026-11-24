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

/** Sets up a secured sale deal (funds held) ready for a dispute. */
async function securedDeal() {
  const seller = await registerUser(app);
  const buyer = await registerUser(app);
  const admin = await createAdmin(app);

  await prisma.user.updateMany({
    where: { id: { in: [seller.id, buyer.id] } },
    data: { emailVerifiedAt: new Date() },
  });
  await prisma.user.update({
    where: { id: seller.id },
    data: { payoutOnboardedAt: new Date(), payoutAccountId: `test_acct_${seller.id}` },
  });

  const listing = await prisma.listing.create({
    data: {
      ownerId: seller.id,
      title: "Dispute camera",
      description: "For dispute tests",
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
    id: `evt_dispute_${deal.id}`,
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

  const transaction = (await prisma.transaction.findFirst({ where: { dealId: deal.id } }))!;
  const net = transaction.amountCents - transaction.feeCents;

  return { seller, buyer, admin, deal, net };
}

function openDispute(token: string, dealId: string, reason = "The item was not as described") {
  return auth(token)(
    request(app)
      .post("/api/v1/disputes")
      .set("Origin", "http://localhost:3000")
      .send({ dealId, reason }),
  );
}

describe("disputes", () => {
  it("lets the buyer open a dispute and freezes the deal", async () => {
    const { buyer, deal } = await securedDeal();

    const response = await openDispute(buyer.accessToken, deal.id).expect(201);
    expect(response.body.data.dispute.status).toBe("OPEN");

    const updated = await prisma.deal.findUnique({ where: { id: deal.id } });
    expect(updated?.status).toBe("DISPUTED");
  });

  it("lets the seller open a dispute too", async () => {
    const { seller, deal } = await securedDeal();

    await openDispute(seller.accessToken, deal.id, "Buyer has not collected").expect(201);
  });

  it("only allows one dispute per deal", async () => {
    const { buyer, deal } = await securedDeal();

    await openDispute(buyer.accessToken, deal.id).expect(201);
    await openDispute(buyer.accessToken, deal.id).expect(409);
  });

  it("rejects a stranger opening a dispute", async () => {
    const { deal } = await securedDeal();
    const stranger = await registerUser(app);

    await openDispute(stranger.accessToken, deal.id).expect(403);
  });

  it("requires the deal to have secured funds", async () => {
    const seller = await registerUser(app);
    const buyer = await registerUser(app);
    await prisma.user.updateMany({
      where: { id: { in: [seller.id, buyer.id] } },
      data: { emailVerifiedAt: new Date() },
    });
    const listing = await prisma.listing.create({
      data: {
        ownerId: seller.id,
        title: "No funds",
        description: "x",
        location: "Lagos",
        status: "ACTIVE",
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
        status: "PROPOSED",
      },
    });

    await openDispute(buyer.accessToken, deal.id).expect(409);
  });

  it("lets an admin resolve with a refund and moves the money", async () => {
    const { buyer, admin, deal, net } = await securedDeal();

    const dispute = await openDispute(buyer.accessToken, deal.id).expect(201);
    const disputeId = dispute.body.data.dispute.id;

    const resolved = await auth(admin.accessToken)(
      request(app)
        .patch(`/api/v1/disputes/${disputeId}/resolve`)
        .set("Origin", "http://localhost:3000")
        .send({ resolution: "REFUND", note: "Item not delivered" }),
    ).expect(200);

    expect(resolved.body.data.dispute.status).toBe("RESOLVED");
    expect(resolved.body.data.dispute.resolution).toBe("REFUND");

    const updatedDeal = await prisma.deal.findUnique({ where: { id: deal.id } });
    expect(updatedDeal?.status).toBe("RESOLVED");

    const refund = await prisma.ledgerEntry.findFirst({
      where: { type: "REFUND", reference: `dispute-refund:${disputeId}` },
    });
    expect(refund?.amountCents).toBe(net);
  });

  it("supports split resolution", async () => {
    const { buyer, admin, deal, net } = await securedDeal();

    const dispute = await openDispute(buyer.accessToken, deal.id).expect(201);
    const disputeId = dispute.body.data.dispute.id;

    await auth(admin.accessToken)(
      request(app)
        .patch(`/api/v1/disputes/${disputeId}/resolve`)
        .set("Origin", "http://localhost:3000")
        .send({ resolution: "SPLIT" }),
    ).expect(200);

    const refund = await prisma.ledgerEntry.findFirst({
      where: { reference: `dispute-refund:${disputeId}` },
    });
    const payout = await prisma.ledgerEntry.findFirst({
      where: { reference: `dispute-payout:${disputeId}` },
    });
    expect(refund?.amountCents).toBe(Math.floor(net / 2));
    expect(payout?.amountCents).toBe(net - Math.floor(net / 2));
  });

  it("is idempotent on repeat resolution", async () => {
    const { buyer, admin, deal } = await securedDeal();

    const dispute = await openDispute(buyer.accessToken, deal.id).expect(201);
    const disputeId = dispute.body.data.dispute.id;

    const body = { resolution: "RELEASE" };
    await auth(admin.accessToken)(
      request(app)
        .patch(`/api/v1/disputes/${disputeId}/resolve`)
        .set("Origin", "http://localhost:3000")
        .send(body),
    ).expect(200);

    await auth(admin.accessToken)(
      request(app)
        .patch(`/api/v1/disputes/${disputeId}/resolve`)
        .set("Origin", "http://localhost:3000")
        .send(body),
    ).expect(409);
  });

  it("only admins can resolve", async () => {
    const { buyer, deal } = await securedDeal();
    const dispute = await openDispute(buyer.accessToken, deal.id).expect(201);

    await auth(buyer.accessToken)(
      request(app)
        .patch(`/api/v1/disputes/${dispute.body.data.dispute.id}/resolve`)
        .set("Origin", "http://localhost:3000")
        .send({ resolution: "REFUND" }),
    ).expect(403);
  });
});
