import { prisma } from "../../db/prisma.js";
import type {
  ListingCondition,
  ListingStatus,
  ListingType,
} from "../../generated/prisma/client.js";
import type { ListListingsQuery } from "./listing.schemas.js";

/**
 * Data access for listings. Services own business rules; this module only talks
 * to Prisma and keeps transaction handling close to the writes that must be
 * atomic.
 */

export function createListing(data: {
  ownerId: string;
  categoryId: string | null;
  title: string;
  description: string;
  condition: ListingCondition;
  priceCents: number | null;
  listingType: ListingType;
  status: ListingStatus;
  location: string;
}) {
  return prisma.listing.create({
    data: {
      owner: { connect: { id: data.ownerId } },
      ...(data.categoryId ? { category: { connect: { id: data.categoryId } } } : {}),
      title: data.title,
      description: data.description,
      condition: data.condition,
      priceCents: data.priceCents,
      listingType: data.listingType,
      status: data.status,
      location: data.location,
    },
    include: {
      owner: { select: { id: true, profile: true } },
      category: { select: { id: true, name: true, slug: true } },
      images: {
        select: {
          id: true,
          key: true,
          url: true,
          mimeType: true,
          sizeBytes: true,
          width: true,
          height: true,
          position: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { position: "asc" },
      },
    },
  });
}

export function findListingById(listingId: string) {
  return prisma.listing.findUnique({
    where: { id: listingId },
    include: {
      owner: { select: { id: true, profile: true } },
      category: { select: { id: true, name: true, slug: true } },
      images: {
        select: {
          id: true,
          key: true,
          url: true,
          mimeType: true,
          sizeBytes: true,
          width: true,
          height: true,
          position: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { position: "asc" },
      },
    },
  });
}

export function updateListing(
  listingId: string,
  data: Partial<{
    title: string;
    description: string;
    condition: ListingCondition;
    priceCents: number | null;
    listingType: ListingType;
    status: ListingStatus;
    categoryId: string | null;
    location: string;
  }>,
) {
  return prisma.listing.update({
    where: { id: listingId },
    data: {
      ...(data.title !== undefined && { title: data.title }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.condition !== undefined && { condition: data.condition }),
      ...(data.priceCents !== undefined && { priceCents: data.priceCents }),
      ...(data.listingType !== undefined && { listingType: data.listingType }),
      ...(data.status !== undefined && { status: data.status }),
      ...(data.categoryId !== undefined && {
        category: data.categoryId
          ? { connect: { id: data.categoryId } }
          : { disconnect: true },
      }),
      ...(data.location !== undefined && { location: data.location }),
    },
    include: {
      owner: { select: { id: true, profile: true } },
      category: { select: { id: true, name: true, slug: true } },
      images: {
        select: {
          id: true,
          key: true,
          url: true,
          mimeType: true,
          sizeBytes: true,
          width: true,
          height: true,
          position: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { position: "asc" },
      },
    },
  });
}

export function deleteListing(listingId: string) {
  return prisma.listing.delete({
    where: { id: listingId },
  });
}

/**
 * Lists active (publicly visible) listings with cursor-based pagination and
 * optional filters. Only listings with status ACTIVE are returned to the
 * public; drafts, reserved, sold, exchanged, and removed listings are hidden
 * unless the caller is the owner (handled in the service layer).
 */
export function listActiveListings(query: ListListingsQuery) {
  const where = {
    status: "ACTIVE" as ListingStatus,
    ...(query.category ? { categoryId: query.category } : {}),
    ...(query.condition ? { condition: query.condition } : {}),
    ...(query.listingType ? { listingType: query.listingType } : {}),
    ...(query.q
      ? {
          OR: [
            { title: { contains: query.q, mode: "insensitive" as const } },
            {
              description: {
                contains: query.q,
                mode: "insensitive" as const,
              },
            },
          ],
        }
      : {}),
    ...(query.minPrice !== undefined || query.maxPrice !== undefined
      ? {
          priceCents: {
            ...(query.minPrice !== undefined ? { gte: query.minPrice } : {}),
            ...(query.maxPrice !== undefined ? { lte: query.maxPrice } : {}),
          },
        }
      : {}),
  };

  return prisma.listing.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: query.limit + 1,
    cursor: query.cursor ? { id: query.cursor } : undefined,
    skip: query.cursor ? 1 : 0,
    include: {
      owner: { select: { id: true, profile: true } },
      category: { select: { id: true, name: true, slug: true } },
    },
  });
}

/**
 * Lists all listings for a specific owner, including drafts. Used by the
 * owner's own listing management pages.
 */
export function listListingsByOwner(
  ownerId: string,
  { limit, cursor }: { limit: number; cursor?: string },
) {
  return prisma.listing.findMany({
    where: { ownerId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: {
      owner: { select: { id: true, profile: true } },
      category: { select: { id: true, name: true, slug: true } },
    },
  });
}

export function listCategories() {
  return prisma.category.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { listings: { where: { status: "ACTIVE" } } } },
    },
  });
}

export function createCategory(data: { name: string; slug: string }) {
  return prisma.category.create({
    data,
  });
}
