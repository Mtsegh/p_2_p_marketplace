import { AppError } from "../../lib/app-error.js";
import { prisma } from "../../db/prisma.js";
import { toCategoryDto, toListingDto } from "./listing.dto.js";
import * as repository from "./listing.repository.js";
import type { ListingWithRelations } from "./listing.dto.js";
import type {
  CreateListingInput,
  ListListingsQuery,
  UpdateListingInput,
} from "./listing.schemas.js";

/**
 * Creates a listing for the authenticated user. Only verified email users can
 * create listings; the listing starts as a draft and must be published
 * separately.
 */
export async function createListing(
  ownerId: string,
  input: CreateListingInput,
) {
  // A sale or both listing must have a price; exchange-only may not.
  if (
    (input.listingType === "SALE" || input.listingType === "BOTH") &&
    input.priceCents === undefined
  ) {
    throw new AppError(
      "PRICE_REQUIRED",
      422,
      "A price is required when the listing can be sold",
    );
  }

  return repository.createListing({
    ownerId,
    categoryId: input.categoryId ?? null,
    title: input.title,
    description: input.description,
    condition: input.condition,
    priceCents: input.priceCents ?? null,
    listingType: input.listingType,
    status: "DRAFT",
    location: input.location,
  });
}

/**
 * Updates a listing. Only the owner can update; a listing that is part of an
 * active deal (reserved/sold/exchanged) cannot be changed.
 */
export async function updateListing(
  listingId: string,
  userId: string,
  input: UpdateListingInput,
) {
  const listing = await repository.findListingById(listingId);

  if (!listing) {
    throw AppError.notFound("Listing not found");
  }

  if (listing.ownerId !== userId) {
    throw new AppError(
      "FORBIDDEN",
      403,
      "You do not own this listing",
    );
  }

  // A listing in a deal cannot be edited or deleted.
  if (
    listing.status === "RESERVED" ||
    listing.status === "SOLD" ||
    listing.status === "EXCHANGED"
  ) {
    throw new AppError(
      "LISTING_IN_DEAL",
      409,
      "This listing is part of an active deal and cannot be changed",
    );
  }

  return repository.updateListing(listingId, {
    ...(input.title !== undefined && { title: input.title }),
    ...(input.description !== undefined && { description: input.description }),
    ...(input.condition !== undefined && { condition: input.condition }),
    ...(input.priceCents !== undefined && { priceCents: input.priceCents }),
    ...(input.listingType !== undefined && { listingType: input.listingType }),
    ...(input.status !== undefined && { status: input.status }),
    ...(input.categoryId !== undefined && {
      categoryId: input.categoryId ?? null,
    }),
    ...(input.location !== undefined && { location: input.location }),
  });
}

/**
 * Deletes a listing. Only the owner can delete; drafts and removed listings
 * can be deleted, but listings in an active deal cannot.
 */
export async function deleteListing(listingId: string, userId: string) {
  const listing = await repository.findListingById(listingId);

  if (!listing) {
    throw AppError.notFound("Listing not found");
  }

  if (listing.ownerId !== userId) {
    throw new AppError(
      "FORBIDDEN",
      403,
      "You do not own this listing",
    );
  }

  if (
    listing.status === "RESERVED" ||
    listing.status === "SOLD" ||
    listing.status === "EXCHANGED"
  ) {
    throw new AppError(
      "LISTING_IN_DEAL",
      409,
      "This listing is part of an active deal and cannot be deleted",
    );
  }

  return repository.deleteListing(listingId);
}

/**
 * Publishes a draft listing, making it visible to other members. Requires a
 * verified email address.
 */
export async function publishListing(listingId: string, userId: string) {
  const listing = await repository.findListingById(listingId);

  if (!listing) {
    throw AppError.notFound("Listing not found");
  }

  if (listing.ownerId !== userId) {
    throw new AppError(
      "FORBIDDEN",
      403,
      "You do not own this listing",
    );
  }

  if (listing.status !== "DRAFT") {
    throw new AppError(
      "INVALID_STATUS",
      409,
      "Only draft listings can be published",
    );
  }

  return repository.updateListing(listingId, { status: "ACTIVE" });
}

/**
 * Returns public listings with pagination and filters. Only ACTIVE listings
 * are visible.
 */
export async function listActiveListings(query: ListListingsQuery) {
  const listings = await repository.listActiveListings(query);

  const nextCursor =
    listings.length > query.limit
      ? listings[query.limit]!.id
      : null;

  return {
    listings: listings
      .slice(0, query.limit)
      .map((listing) => toListingDto(listing as ListingWithRelations)),
    nextCursor,
  };
}

/**
 * Returns all listings owned by a user, including drafts.
 */
export async function listListingsByOwner(
  ownerId: string,
  { limit, cursor }: { limit: number; cursor?: string },
) {
  const listings = await repository.listListingsByOwner(ownerId, {
    limit,
    cursor,
  });

  const nextCursor =
    listings.length > limit ? listings[limit]!.id : null;

  return {
    listings: listings
      .slice(0, limit)
      .map((listing) => toListingDto(listing as ListingWithRelations)),
    nextCursor,
  };
}

/**
 * Returns all categories with their active listing count.
 */
export async function listCategories() {
  const categories = await repository.listCategories();

  return categories.map((category) => ({
    ...toCategoryDto(category),
    activeListingCount: category._count.listings,
  }));
}

/**
 * Creates a new category. Admin only.
 */
export async function createCategory(input: { name: string; slug: string }) {
  const existing = await prisma.category.findUnique({
    where: { slug: input.slug },
  });

  if (existing) {
    throw new AppError("CATEGORY_IN_USE", 409, "This category slug already exists");
  }

  return prisma.category.create({
    data: { name: input.name, slug: input.slug },
  });
}
