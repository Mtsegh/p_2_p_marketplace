import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { prisma } from "../src/db/prisma.js";
import { registerUser, resetIdentityState } from "./helpers.js";

const app = createApp();

beforeEach(async () => {
  await resetIdentityState();
});

describe("GET /api/v1/listings/categories", () => {
  it("returns categories rather than treating 'categories' as a listing id", async () => {
    // resetIdentityState truncates categories, so create one for this test.
    await prisma.category.create({
      data: { name: "Electronics", slug: "electronics" },
    });

    const response = await request(app)
      .get("/api/v1/listings/categories")
      .expect(200);

    expect(Array.isArray(response.body.data.categories)).toBe(true);
    expect(response.body.data.categories).toHaveLength(1);
    expect(response.body.data.categories[0]).toMatchObject({
      id: expect.any(String),
      name: "Electronics",
      slug: "electronics",
      activeListingCount: expect.any(Number),
    });
  });
});

describe("GET /api/v1/listings", () => {
  it("returns only active listings with cursor pagination", async () => {
    const user = await registerUser(app);

    await prisma.listing.create({
      data: {
        ownerId: user.id,
        title: "Hidden draft",
        description: "Not published",
        location: "Lagos",
        status: "DRAFT",
      },
    });

    await prisma.listing.create({
      data: {
        ownerId: user.id,
        title: "Public item",
        description: "Published and visible",
        location: "Lagos",
        status: "ACTIVE",
      },
    });

    const response = await request(app).get("/api/v1/listings").expect(200);

    expect(response.body.data.listings).toHaveLength(1);
    expect(response.body.data.listings[0].title).toBe("Public item");
    // The DTO maps images; list queries must include that relation or the
    // whole browse endpoint throws a 500.
    expect(response.body.data.listings[0].images).toEqual([]);
    expect(response.body.data.nextCursor).toBeNull();
  });
});

describe("GET /api/v1/listings pagination", () => {
  it("does not skip a listing between pages", async () => {
    const user = await registerUser(app);

    // Create 5 active listings; request pages of 2.
    const created = await prisma.listing.createManyAndReturn({
      data: Array.from({ length: 5 }).map((_, i) => ({
        ownerId: user.id,
        title: `Item ${i + 1}`,
        description: "Description",
        location: "Lagos",
        status: "ACTIVE" as const,
      })),
    });

    const seen: string[] = [];
    let cursor: string | undefined;

    do {
      const response = await request(app)
        .get("/api/v1/listings")
        .query({ limit: 2, ...(cursor ? { cursor } : {}) })
        .expect(200);

      seen.push(
        ...response.body.data.listings.map((l: { id: string }) => l.id),
      );
      cursor = response.body.data.nextCursor ?? undefined;
    } while (cursor);

    // Newest-first order, so compare against created ids reversed.
    expect(seen).toHaveLength(created.length);
    expect(new Set(seen).size).toBe(created.length);
  });
});

describe("GET /api/v1/listings/:listingId", () => {
  it("returns a single listing with its images array", async () => {
    const user = await registerUser(app);
    const listing = await prisma.listing.create({
      data: {
        ownerId: user.id,
        title: "A bike",
        description: "Good condition",
        location: "Lagos",
        status: "ACTIVE",
      },
    });

    const response = await request(app)
      .get(`/api/v1/listings/${listing.id}`)
      .expect(200);

    expect(response.body.data.listing).toMatchObject({
      id: listing.id,
      title: "A bike",
      images: [],
    });
  });

  it("returns 404 for a missing listing", async () => {
    await request(app)
      .get("/api/v1/listings/00000000-0000-4000-8000-000000000000")
      .expect(404);
  });
});

describe("GET /api/v1/listings search and filters", () => {
  async function seedListings() {
    const user = await registerUser(app);
    const electronics = await prisma.category.create({
      data: { name: "Electronics", slug: "electronics" },
    });

    await prisma.listing.createMany({
      data: [
        {
          ownerId: user.id,
          title: "Vintage camera",
          description: "A film camera in good condition",
          location: "Lagos",
          categoryId: electronics.id,
          priceCents: 45000,
          status: "ACTIVE",
        },
        {
          ownerId: user.id,
          title: "Mountain bike",
          description: "Great for trails",
          location: "Abuja",
          priceCents: 12000,
          status: "ACTIVE",
        },
        {
          ownerId: user.id,
          title: "Draft camera",
          description: "Not published yet",
          location: "Lagos",
          status: "DRAFT",
        },
      ],
    });
  }

  it("matches by keyword via full-text search", async () => {
    await seedListings();

    const response = await request(app)
      .get("/api/v1/listings")
      .query({ q: "camera" })
      .expect(200);

    expect(response.body.data.total).toBe(1);
    expect(response.body.data.listings[0].title).toBe("Vintage camera");
  });

  it("matches partial keywords via trigram search", async () => {
    await seedListings();

    const response = await request(app)
      .get("/api/v1/listings")
      .query({ q: "cam" })
      .expect(200);

    expect(response.body.data.total).toBe(1);
  });

  it("filters by location", async () => {
    await seedListings();

    const response = await request(app)
      .get("/api/v1/listings")
      .query({ location: "abu" })
      .expect(200);

    expect(response.body.data.total).toBe(1);
    expect(response.body.data.listings[0].title).toBe("Mountain bike");
  });

  it("filters by category slug", async () => {
    await seedListings();

    const response = await request(app)
      .get("/api/v1/listings")
      .query({ category: "electronics" })
      .expect(200);

    expect(response.body.data.total).toBe(1);
  });

  it("sorts by price ascending", async () => {
    await seedListings();

    const response = await request(app)
      .get("/api/v1/listings")
      .query({ sort: "price_asc" })
      .expect(200);

    const prices = response.body.data.listings.map(
      (item: { priceCents: number }) => item.priceCents,
    );
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });

  it("filters by price range", async () => {
    await seedListings();

    const response = await request(app)
      .get("/api/v1/listings")
      .query({ minPrice: 20000, maxPrice: 50000 })
      .expect(200);

    expect(response.body.data.total).toBe(1);
    expect(response.body.data.listings[0].title).toBe("Vintage camera");
  });

  it("reports the total matching count before pagination", async () => {
    await seedListings();

    const response = await request(app)
      .get("/api/v1/listings")
      .query({ limit: 1 })
      .expect(200);

    expect(response.body.data.listings).toHaveLength(1);
    expect(response.body.data.total).toBe(2);
    expect(response.body.data.nextCursor).not.toBeNull();
  });
});
