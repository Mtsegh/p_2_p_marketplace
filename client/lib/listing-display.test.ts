import { describe, expect, it } from "vitest";
import {
  conditionLabel,
  formatPrice,
  listingTypeLabel,
  primaryImage,
} from "./listing-display";

describe("formatPrice", () => {
  it("formats whole and fractional cents as USD", () => {
    expect(formatPrice(45000)).toBe("$450.00");
    expect(formatPrice(1234)).toBe("$12.34");
    expect(formatPrice(0)).toBe("$0.00");
  });

  it("returns null for exchange-only listings", () => {
    expect(formatPrice(null)).toBeNull();
  });
});

describe("listingTypeLabel", () => {
  it("uses one clear label per listing type", () => {
    expect(listingTypeLabel("SALE")).toBe("Sale");
    expect(listingTypeLabel("EXCHANGE")).toBe("Swap");
    expect(listingTypeLabel("BOTH")).toBe("Sale or Swap");
  });
});

describe("conditionLabel", () => {
  it("maps enum values to readable labels", () => {
    expect(conditionLabel("LIKE_NEW")).toBe("Like new");
    expect(conditionLabel("FAIR")).toBe("Fair");
  });
});

describe("primaryImage", () => {
  it("returns the lowest-position image", () => {
    const images = [
      { id: "b", position: 1 },
      { id: "a", position: 0 },
    ];

    expect(primaryImage(images)?.id).toBe("a");
  });

  it("returns undefined for an empty list", () => {
    expect(primaryImage([])).toBeUndefined();
  });
});
