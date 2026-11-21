import type {
  Category,
  Listing,
  ListingCondition,
  ListingStatus,
  ListingType,
} from "../../generated/prisma/client.js";

export interface ListingDto {
  id: string;
  ownerId: string;
  ownerDisplayName: string;
  categoryId: string | null;
  categoryName: string | null;
  title: string;
  description: string;
  condition: ListingCondition;
  priceCents: number | null;
  listingType: ListingType;
  status: ListingStatus;
  location: string;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryDto {
  id: string;
  name: string;
  slug: string;
}

/**
 * A listing with its owner and category relations included. Used by queries
 * that eagerly load relations so TypeScript knows the shape at compile time.
 */
export interface ListingWithRelations extends Listing {
  owner: { id: string; profile: { displayName: string } | null };
  category: { id: string; name: string; slug: string } | null;
}

/**
 * The only shape listings leave the API in. Built field by field from a narrow
 * select so a future column cannot leak by being added to the model.
 */
export function toListingDto(listing: ListingWithRelations): ListingDto {
  return {
    id: listing.id,
    ownerId: listing.ownerId,
    ownerDisplayName:
      listing.owner.profile?.displayName ?? "Marketplace member",
    categoryId: listing.categoryId,
    categoryName: listing.category?.name ?? null,
    title: listing.title,
    description: listing.description,
    condition: listing.condition,
    priceCents: listing.priceCents,
    listingType: listing.listingType,
    status: listing.status,
    location: listing.location,
    createdAt: listing.createdAt.toISOString(),
    updatedAt: listing.updatedAt.toISOString(),
  };
}

export function toCategoryDto(category: Category): CategoryDto {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
  };
}

export interface ListListingsResult {
  listings: ListingDto[];
  nextCursor: string | null;
}
