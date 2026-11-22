import { describe, expect, it } from "vitest";
import {
  DEFAULT_FILTERS,
  activeFilterCount,
  buildBrowseUrl,
  filtersToQuery,
  parseBrowseFilters,
} from "./browse-filters";

describe("parseBrowseFilters", () => {
  it("returns defaults for empty params", () => {
    expect(parseBrowseFilters({})).toEqual(DEFAULT_FILTERS);
  });

  it("takes the first value for repeated params", () => {
    const filters = parseBrowseFilters({ q: ["camera", "bike"] });

    expect(filters.q).toBe("camera");
  });

  it("ignores invalid enum and price values", () => {
    const filters = parseBrowseFilters({
      condition: "INVALID",
      sort: "bogus",
      minPrice: "not-a-number",
      maxPrice: "-5",
    });

    expect(filters.condition).toBe("");
    expect(filters.sort).toBe("newest");
    expect(filters.minPrice).toBe("");
    expect(filters.maxPrice).toBe("");
  });

  it("keeps valid filters", () => {
    const filters = parseBrowseFilters({
      q: "camera",
      category: "electronics",
      condition: "GOOD",
      listingType: "BOTH",
      minPrice: "10.50",
      maxPrice: "200",
      location: "Lagos",
      sort: "price_asc",
    });

    expect(filters).toEqual({
      q: "camera",
      category: "electronics",
      condition: "GOOD",
      listingType: "BOTH",
      minPrice: "10.50",
      maxPrice: "200",
      location: "Lagos",
      sort: "price_asc",
    });
  });
});

describe("filtersToQuery", () => {
  it("converts price to cents and omits empty filters", () => {
    const query = filtersToQuery({
      ...DEFAULT_FILTERS,
      q: "camera",
      minPrice: "10.50",
      sort: "price_desc",
    });

    expect(query).toEqual({
      q: "camera",
      minPrice: 1050,
      sort: "price_desc",
    });
  });
});

describe("buildBrowseUrl", () => {
  it("round-trips filters through a shareable URL", () => {
    const filters = {
      ...DEFAULT_FILTERS,
      q: "vintage camera",
      category: "electronics",
      condition: "GOOD" as const,
      sort: "price_asc" as const,
    };
    const url = buildBrowseUrl(filters);
    const params = new URL(url, "http://localhost").searchParams;
    const query = Object.fromEntries(params.entries());

    expect(parseBrowseFilters(query)).toEqual(filters);
  });

  it("returns /browse when nothing is active", () => {
    expect(buildBrowseUrl(DEFAULT_FILTERS)).toBe("/browse");
  });
});

describe("activeFilterCount", () => {
  it("counts only active filters, not sort", () => {
    const filters = {
      ...DEFAULT_FILTERS,
      q: "bike",
      category: "sports",
      sort: "price_asc" as const,
    };

    expect(activeFilterCount(filters)).toBe(2);
  });
});
