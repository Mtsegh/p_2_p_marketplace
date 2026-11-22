import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { prisma } from "../src/db/prisma.js";
import { resetIdentityState, registerUser } from "./helpers.js";

const app = createApp();

beforeEach(async () => {
  await resetIdentityState();
});

/** Registers a user, marks their email verified, and creates a draft listing. */
async function verifiedUserWithListing() {
  const user = await registerUser(app);

  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerifiedAt: new Date() },
  });

  const listing = await prisma.listing.create({
    data: {
      ownerId: user.id,
      title: "A camera",
      description: "A vintage camera in good condition.",
      condition: "GOOD",
      listingType: "SALE",
      priceCents: 45000,
      location: "Lagos",
      status: "DRAFT",
    },
  });

  return { user, listing };
}

const validUpload = {
  contentType: "image/jpeg",
  sizeBytes: 1024,
  suggestedFilename: "camera.jpg",
};

describe("POST /api/v1/listings/:listingId/images/presign", () => {
  it("returns a presigned URL for a valid image request", async () => {
    const { user, listing } = await verifiedUserWithListing();

    const response = await request(app)
      .post(`/api/v1/listings/${listing.id}/images/presign`)
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send(validUpload)
      .expect(200);

    expect(response.body.data.upload).toMatchObject({
      key: expect.stringContaining(`listings/${listing.id}/`),
      url: expect.any(String),
      contentType: "image/jpeg",
    });
  });

  it("rejects a disallowed content type", async () => {
    const { user, listing } = await verifiedUserWithListing();

    await request(app)
      .post(`/api/v1/listings/${listing.id}/images/presign`)
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ ...validUpload, contentType: "application/pdf" })
      .expect(422);
  });

  it("rejects a file that is too large", async () => {
    const { user, listing } = await verifiedUserWithListing();

    await request(app)
      .post(`/api/v1/listings/${listing.id}/images/presign`)
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ ...validUpload, sizeBytes: 9 * 1_024 * 1_024 })
      .expect(422);
  });

  it("rejects a request from a non-owner", async () => {
    const { listing } = await verifiedUserWithListing();
    const other = await registerUser(app);
    await prisma.user.update({
      where: { id: other.id },
      data: { emailVerifiedAt: new Date() },
    });

    await request(app)
      .post(`/api/v1/listings/${listing.id}/images/presign`)
      .set("Authorization", `Bearer ${other.accessToken}`)
      .send(validUpload)
      .expect(403);
  });

  it("requires authentication", async () => {
    const { listing } = await verifiedUserWithListing();

    await request(app)
      .post(`/api/v1/listings/${listing.id}/images/presign`)
      .send(validUpload)
      .expect(401);
  });
});

describe("POST /api/v1/listings/:listingId/images/complete", () => {
  it("records the image after upload", async () => {
    const { user, listing } = await verifiedUserWithListing();

    const response = await request(app)
      .post(`/api/v1/listings/${listing.id}/images/complete`)
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ key: `listings/${listing.id}/some-uuid.jpg` })
      .expect(200);

    expect(response.body.data.image).toMatchObject({
      key: `listings/${listing.id}/some-uuid.jpg`,
      url: expect.any(String),
      position: 0,
    });

    const detail = await request(app)
      .get(`/api/v1/listings/${listing.id}`)
      .expect(200);

    expect(detail.body.data.listing.images).toHaveLength(1);
  });

  it("rejects a non-owner", async () => {
    const { listing } = await verifiedUserWithListing();
    const other = await registerUser(app);

    await request(app)
      .post(`/api/v1/listings/${listing.id}/images/complete`)
      .set("Authorization", `Bearer ${other.accessToken}`)
      .send({ key: `listings/${listing.id}/some-uuid.jpg` })
      .expect(403);
  });
});

describe("DELETE /api/v1/listings/:listingId/images/:imageId", () => {
  it("deletes an image the caller owns", async () => {
    const { user, listing } = await verifiedUserWithListing();
    const image = await prisma.listingImage.create({
      data: {
        listingId: listing.id,
        key: `listings/${listing.id}/x.jpg`,
        url: "http://localhost/x.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 100,
        position: 0,
      },
    });

    await request(app)
      .delete(`/api/v1/listings/${listing.id}/images/${image.id}`)
      .set("Authorization", `Bearer ${user.accessToken}`)
      .expect(204);

    const remaining = await prisma.listingImage.findUnique({
      where: { id: image.id },
    });

    expect(remaining).toBeNull();
  });

  it("does not delete an image the caller does not own", async () => {
    const { listing } = await verifiedUserWithListing();
    const other = await registerUser(app);
    const image = await prisma.listingImage.create({
      data: {
        listingId: listing.id,
        key: `listings/${listing.id}/y.jpg`,
        url: "http://localhost/y.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 100,
        position: 0,
      },
    });

    await request(app)
      .delete(`/api/v1/listings/${listing.id}/images/${image.id}`)
      .set("Authorization", `Bearer ${other.accessToken}`)
      .expect(403);

    const stillThere = await prisma.listingImage.findUnique({
      where: { id: image.id },
    });

    expect(stillThere).not.toBeNull();
  });
});

describe("PATCH /api/v1/listings/:listingId/images/reorder", () => {
  it("reorders images by the given id list", async () => {
    const { user, listing } = await verifiedUserWithListing();
    const first = await prisma.listingImage.create({
      data: {
        listingId: listing.id,
        key: `listings/${listing.id}/a.jpg`,
        url: "http://localhost/a.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 100,
        position: 0,
      },
    });
    const second = await prisma.listingImage.create({
      data: {
        listingId: listing.id,
        key: `listings/${listing.id}/b.jpg`,
        url: "http://localhost/b.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 100,
        position: 1,
      },
    });

    await request(app)
      .patch(`/api/v1/listings/${listing.id}/images/reorder`)
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ imageIds: [second.id, first.id] })
      .expect(204);

    const reordered = await prisma.listingImage.findUnique({
      where: { id: second.id },
    });

    expect(reordered?.position).toBe(0);
  });
});
