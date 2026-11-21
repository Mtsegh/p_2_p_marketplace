import { apiRequest, apiRequestJson } from "./api";

export type ListingCondition = "NEW" | "LIKE_NEW" | "GOOD" | "FAIR" | "POOR";
export type ListingType = "SALE" | "EXCHANGE" | "BOTH";
export type ListingStatus =
  | "DRAFT"
  | "ACTIVE"
  | "RESERVED"
  | "SOLD"
  | "EXCHANGED"
  | "REMOVED";

export interface Listing {
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

export interface Category {
  id: string;
  name: string;
  slug: string;
  activeListingCount?: number;
}

export interface ListListingsResult {
  listings: Listing[];
  nextCursor: string | null;
}

export interface CreateListingInput {
  title: string;
  description: string;
  condition?: ListingCondition;
  priceCents?: number | null;
  listingType?: ListingType;
  categoryId?: string;
  location: string;
}

export interface UpdateListingInput {
  title?: string;
  description?: string;
  condition?: ListingCondition;
  priceCents?: number;
  listingType?: ListingType;
  categoryId?: string;
  location?: string;
  status?: ListingStatus;
}

export interface ListListingsQuery {
  category?: string;
  condition?: ListingCondition;
  listingType?: ListingType;
  minPrice?: number;
  maxPrice?: number;
  q?: string;
  status?: ListingStatus;
  limit?: number;
  cursor?: string;
}

/** Creates a draft listing for the signed-in user. */
export async function createListing(
  input: CreateListingInput,
): Promise<Listing> {
  const response = await apiRequestJson<{ data: { listing: Listing } }>(
    "/api/v1/listings",
    "POST",
    input,
  );

  return response.data.listing;
}

/** Fetches public listings with optional filters and cursor pagination. */
export async function fetchListings(
  query: ListListingsQuery = {},
): Promise<ListListingsResult> {
  const params = new URLSearchParams();

  if (query.category) params.set("category", query.category);
  if (query.condition) params.set("condition", query.condition);
  if (query.listingType) params.set("listingType", query.listingType);
  if (query.minPrice !== undefined)
    params.set("minPrice", String(query.minPrice));
  if (query.maxPrice !== undefined)
    params.set("maxPrice", String(query.maxPrice));
  if (query.q) params.set("q", query.q);
  if (query.status) params.set("status", query.status);
  if (query.limit !== undefined) params.set("limit", String(query.limit));
  if (query.cursor) params.set("cursor", query.cursor);

  const path = `/api/v1/listings?${params.toString()}`;
  const response = await apiRequest<{ data: ListListingsResult }>(path);

  return response.data;
}

/** Fetches a single listing by id. Returns 404 if missing or not public. */
export async function fetchListing(listingId: string): Promise<Listing> {
  const response = await apiRequest<{ data: { listing: Listing } }>(
    `/api/v1/listings/${encodeURIComponent(listingId)}`,
  );

  return response.data.listing;
}

/** Updates a listing the user owns. */
export async function updateListing(
  listingId: string,
  input: UpdateListingInput,
): Promise<Listing> {
  const response = await apiRequestJson<{ data: { listing: Listing } }>(
    `/api/v1/listings/${encodeURIComponent(listingId)}`,
    "PATCH",
    input,
  );

  return response.data.listing;
}

/** Deletes a listing the user owns. */
export async function deleteListing(listingId: string): Promise<void> {
  await apiRequestJson<null>(
    `/api/v1/listings/${encodeURIComponent(listingId)}`,
    "DELETE",
  );
}

/** Publishes a draft listing, making it visible to other members. */
export async function publishListing(
  listingId: string,
): Promise<Listing> {
  const response = await apiRequestJson<{ data: { listing: Listing } }>(
    `/api/v1/listings/${encodeURIComponent(listingId)}/publish`,
    "POST",
  );

  return response.data.listing;
}

/** Fetches all categories with their active listing counts. */
export async function fetchCategories(): Promise<Category[]> {
  const response = await apiRequest<{ data: { categories: Category[] } }>(
    "/api/v1/listings/categories",
  );

  return response.data.categories;
}
