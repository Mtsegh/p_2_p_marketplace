import type {
  ListListingsQuery,
  ListingCondition,
  ListingType,
} from "./listings-api";

export type SortValue = "newest" | "price_asc" | "price_desc" | "relevance";

const SORTS: SortValue[] = ["newest", "price_asc", "price_desc", "relevance"];
const CONDITIONS: ListingCondition[] = [
  "NEW",
  "LIKE_NEW",
  "GOOD",
  "FAIR",
  "POOR",
];
const TYPES: ListingType[] = ["SALE", "EXCHANGE", "BOTH"];

/** All filter state, derived from the URL so a shared link reproduces a search. */
export interface BrowseFilters {
  q: string;
  category: string; // category slug (or id)
  condition: ListingCondition | "";
  listingType: ListingType | "";
  minPrice: string; // whole currency units as typed
  maxPrice: string;
  location: string;
  sort: SortValue;
}

export const DEFAULT_FILTERS: BrowseFilters = {
  q: "",
  category: "",
  condition: "",
  listingType: "",
  minPrice: "",
  maxPrice: "",
  location: "",
  sort: "newest",
};

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function oneOf<T extends string>(
  value: string,
  options: readonly T[],
  fallback: T | "",
): T | "" {
  return options.includes(value as T) ? (value as T) : fallback;
}

/** Parses URL search params into validated filters. Unknown values are ignored. */
export function parseBrowseFilters(params: SearchParams): BrowseFilters {
  const minPrice = first(params.minPrice);
  const maxPrice = first(params.maxPrice);

  return {
    q: first(params.q).slice(0, 200),
    category: first(params.category).slice(0, 100),
    condition: oneOf(first(params.condition), CONDITIONS, ""),
    listingType: oneOf(first(params.listingType), TYPES, ""),
    minPrice: /^\d+(\.\d+)?$/.test(minPrice) ? minPrice : "",
    maxPrice: /^\d+(\.\d+)?$/.test(maxPrice) ? maxPrice : "",
    location: first(params.location).slice(0, 200),
    sort: SORTS.includes(first(params.sort) as SortValue)
      ? (first(params.sort) as SortValue)
      : "newest",
  };
}

function toCents(value: string): number | undefined {
  if (!value) return undefined;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0
    ? Math.round(amount * 100)
    : undefined;
}

/** Converts filters to the API query, omitting empty values. */
export function filtersToQuery(
  filters: BrowseFilters,
  extra: Partial<ListListingsQuery> = {},
): ListListingsQuery {
  return {
    ...extra,
    ...(filters.q.trim() ? { q: filters.q.trim() } : {}),
    ...(filters.category ? { category: filters.category } : {}),
    ...(filters.condition ? { condition: filters.condition } : {}),
    ...(filters.listingType ? { listingType: filters.listingType } : {}),
    ...(toCents(filters.minPrice) !== undefined
      ? { minPrice: toCents(filters.minPrice) }
      : {}),
    ...(toCents(filters.maxPrice) !== undefined
      ? { maxPrice: toCents(filters.maxPrice) }
      : {}),
    ...(filters.location.trim() ? { location: filters.location.trim() } : {}),
    sort: filters.sort,
  };
}

/** Builds a shareable /browse URL from filters, dropping defaults and the cursor. */
export function buildBrowseUrl(filters: BrowseFilters): string {
  const params = new URLSearchParams();

  if (filters.q.trim()) params.set("q", filters.q.trim());
  if (filters.category) params.set("category", filters.category);
  if (filters.condition) params.set("condition", filters.condition);
  if (filters.listingType) params.set("listingType", filters.listingType);
  if (filters.minPrice) params.set("minPrice", filters.minPrice);
  if (filters.maxPrice) params.set("maxPrice", filters.maxPrice);
  if (filters.location.trim()) params.set("location", filters.location.trim());
  if (filters.sort !== "newest") params.set("sort", filters.sort);

  const query = params.toString();
  return query ? `/browse?${query}` : "/browse";
}

/** Counts active (non-default) filters for the "Clear all" / chips UI. */
export function activeFilterCount(filters: BrowseFilters): number {
  let count = 0;
  if (filters.q.trim()) count += 1;
  if (filters.category) count += 1;
  if (filters.condition) count += 1;
  if (filters.listingType) count += 1;
  if (filters.minPrice) count += 1;
  if (filters.maxPrice) count += 1;
  if (filters.location.trim()) count += 1;
  // sort is not a filter, and never reset by "Clear filters".
  return count;
}

/** A stable key for React Query, including every value that changes the result. */
export function filtersKey(filters: BrowseFilters): string {
  return JSON.stringify(filters);
}
