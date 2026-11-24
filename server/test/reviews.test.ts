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

async function completedDeal() {
  const seller = await registerUser(app);
  const buyer = await registerUser(app);

  const listing = await prisma.listing.create({
    data: {
      ownerId: seller.id,
      title: "Reviewed item",
      description: "x",
      location: "Lagos",
      status: "SOLD",
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
      status: "COMPLETED",
      completedAt: new Date(),
      history: { create: { fromStatus: "PAYMENT_PENDING", toStatus: "COMPLETED" } },
    },
  });

  return { seller, buyer, deal };
}

function review(token: string, dealId: string, rating: number, comment?: string) {
  return auth(token)(
    request(app)
      .post("/api/v1/reviews")
      .set("Origin", "http://localhost:3000")
      .send({ dealId, rating, ...(comment ? { comment } : {}) }),
  );
}

describe("reviews", () => {
  it("lets a completed-deal participant review the other side", async () => {
    const { buyer, seller, deal } = await completedDeal();

    const response = await review(buyer.accessToken, deal.id, 5, "Great seller").expect(201);
    expect(response.body.data.review).toMatchObject({
      dealId: deal.id,
      authorId: buyer.id,
      subjectId: seller.id,
      rating: 5,
      comment: "Great seller",
    });
  });

  it("supports two-way reviews", async () => {
    const { buyer, seller, deal } = await completedDeal();

    await review(buyer.accessToken, deal.id, 5).expect(201);
    await review(seller.accessToken, deal.id, 4).expect(201);

    const count = await prisma.review.count({ where: { dealId: deal.id } });
    expect(count).toBe(2);
  });

  it("rejects a second review from the same author", async () => {
    const { buyer, deal } = await completedDeal();

    await review(buyer.accessToken, deal.id, 5).expect(201);
    await review(buyer.accessToken, deal.id, 3).expect(409);
  });

  it("rejects a stranger's review", async () => {
    const { deal } = await completedDeal();
    const stranger = await registerUser(app);

    await review(stranger.accessToken, deal.id, 5).expect(403);
  });

  it("rejects reviews for a deal that is not completed", async () => {
    const seller = await registerUser(app);
    const buyer = await registerUser(app);
    const listing = await prisma.listing.create({
      data: {
        ownerId: seller.id,
        title: "Pending",
        description: "x",
        location: "Lagos",
        status: "ACTIVE",
      },
    });
    const deal = await prisma.deal.create({
      data: {
        listingId: listing.id,
        buyerId: buyer.id,
        sellerId: seller.id,
        status: "PROPOSED",
      },
    });

    await review(buyer.accessToken, deal.id, 5).expect(409);
  });

  it("validates the rating", async () => {
    const { buyer, deal } = await completedDeal();

    await review(buyer.accessToken, deal.id, 6).expect(422);
    await review(buyer.accessToken, deal.id, 0).expect(422);
  });

  it("reports trust stats and paginates reviews", async () => {
    const { buyer, seller, deal } = await completedDeal();

    await review(buyer.accessToken, deal.id, 5).expect(201);

    const stats = await request(app)
      .get(`/api/v1/reviews/trust?userId=${seller.id}`)
      .expect(200);
    expect(stats.body.data).toMatchObject({ averageRating: 5, reviewCount: 1 });

    const list = await request(app)
      .get(`/api/v1/reviews?userId=${seller.id}`)
      .expect(200);
    expect(list.body.data.reviews).toHaveLength(1);
    expect(list.body.data.reviews[0].subjectId).toBe(seller.id);
  });

  it("lets the author find their own review for a deal", async () => {
    const { buyer, deal } = await completedDeal();

    await review(buyer.accessToken, deal.id, 4).expect(201);

    const mine = await auth(buyer.accessToken)(
      request(app).get(`/api/v1/reviews/mine?dealId=${deal.id}`),
    ).expect(200);
    expect(mine.body.data.review).toMatchObject({ dealId: deal.id, rating: 4 });
  });
});
