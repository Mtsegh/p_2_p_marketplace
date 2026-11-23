import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { prisma } from "../src/db/prisma.js";
import { readOutbox } from "../src/modules/email/memory.provider.js";
import { registerUser, resetIdentityState } from "./helpers.js";

const app = createApp();

beforeEach(async () => {
  await resetIdentityState();
});

function auth(token: string) {
  return (req: request.Test) => req.set("Authorization", `Bearer ${token}`);
}

async function verifiedUsersWithListing() {
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
      title: "Email test camera",
      description: "For notification tests",
      location: "Lagos",
      status: "ACTIVE",
      priceCents: 10000,
    },
  });

  return { seller, buyer, listing };
}

describe("deal notification emails", () => {
  it("emails the seller when a proposal is received", async () => {
    const { buyer, listing } = await verifiedUsersWithListing();

    await auth(buyer.accessToken)(
      request(app)
        .post("/api/v1/deals")
        .set("Origin", "http://localhost:3000")
        .send({ listingId: listing.id, amountCents: 9000 }),
    ).expect(201);

    const outbox = readOutbox();
    const sellerEmail = await prisma.user.findUnique({
      where: { id: listing.ownerId },
      select: { email: true },
    });
    const message = [...outbox]
      .reverse()
      .find(
        (mail) =>
          mail.to === sellerEmail!.email &&
          mail.subject === "You received a new offer",
      );

    expect(message).toBeDefined();
    expect(message?.subject).toBe("You received a new offer");
    expect(message?.text).toContain("Email test camera");
    expect(message?.html).toContain("View deal");
  });

  it("emails the buyer when their proposal is accepted, once", async () => {
    const { seller, buyer, listing } = await verifiedUsersWithListing();

    const deal = await auth(buyer.accessToken)(
      request(app)
        .post("/api/v1/deals")
        .set("Origin", "http://localhost:3000")
        .send({ listingId: listing.id, amountCents: 9000 }),
    ).expect(201);

    await auth(seller.accessToken)(
      request(app)
        .post(`/api/v1/deals/${deal.body.data.deal.id}/accept`)
        .set("Origin", "http://localhost:3000"),
    ).expect(200);

    const buyerRecord = await prisma.user.findUnique({
      where: { id: buyer.id },
      select: { email: true },
    });
    const accepted = readOutbox().filter(
      (mail) =>
        mail.to === buyerRecord!.email &&
        mail.subject === "Your offer was accepted",
    );
    expect(accepted).toHaveLength(1);
  });

  it("records notification events so duplicates are suppressed", async () => {
    const { buyer, listing } = await verifiedUsersWithListing();

    await auth(buyer.accessToken)(
      request(app)
        .post("/api/v1/deals")
        .set("Origin", "http://localhost:3000")
        .send({ listingId: listing.id, amountCents: 9000 }),
    ).expect(201);

    const events = await prisma.notificationEvent.count();
    expect(events).toBe(1);

    const outbox = readOutbox();
    expect(
      outbox.filter((mail) => mail.subject === "You received a new offer"),
    ).toHaveLength(1);
  });
});
