import { z } from "zod";

/**
 * The client duplicates these rules for inline validation. Keep the shapes in
 * sync when either side changes; there is no shared package by design.
 */

const title = z
  .string()
  .trim()
  .min(1, "Enter a title")
  .max(200, "Use 200 characters or fewer");

const description = z
  .string()
  .trim()
  .min(1, "Enter a description")
  .max(2000, "Use 2000 characters or fewer");

function hasForbiddenControlCharacter(value: string): boolean {
  return Array.from(value).some(
    (char) => char !== "\n" && char !== "\r" && /\p{Cc}/u.test(char),
  );
}

const location = z
  .string()
  .trim()
  .min(1, "Enter a location")
  .max(200, "Use 200 characters or fewer")
  .refine(
    (value) => !hasForbiddenControlCharacter(value),
    "Remove invisible control characters",
  );

const priceCents = z
  .number()
  .int()
  .min(0, "Price must be zero or more")
  .max(10_000_000_00, "Price is too high");

const categoryId = z.string().uuid("Category id must be a UUID").optional();

export const createListingSchema = z
  .object({
    title,
    description,
    condition: z
      .enum(["NEW", "LIKE_NEW", "GOOD", "FAIR", "POOR"])
      .default("GOOD"),
    priceCents: priceCents.optional(),
    listingType: z
      .enum(["SALE", "EXCHANGE", "BOTH"])
      .default("BOTH"),
    categoryId,
    location,
  })
  .strict();

export const updateListingSchema = z
  .object({
    title: title.optional(),
    description: description.optional(),
    condition: z
      .enum(["NEW", "LIKE_NEW", "GOOD", "FAIR", "POOR"])
      .optional(),
    priceCents: priceCents.optional(),
    listingType: z.enum(["SALE", "EXCHANGE", "BOTH"]).optional(),
    categoryId,
    location: location.optional(),
    status: z
      .enum(["DRAFT", "ACTIVE", "RESERVED", "SOLD", "EXCHANGED", "REMOVED"])
      .optional(),
  })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "Provide at least one listing field",
  });

export const listingParamsSchema = z
  .object({ listingId: z.string().uuid("Listing id must be a UUID") })
  .strict();

export const listListingsQuerySchema = z
  .object({
    category: z.string().optional(),
    condition: z.enum(["NEW", "LIKE_NEW", "GOOD", "FAIR", "POOR"]).optional(),
    listingType: z
      .enum(["SALE", "EXCHANGE", "BOTH"])
      .optional(),
    minPrice: z
      .number()
      .int()
      .min(0)
      .optional(),
    maxPrice: z
      .number()
      .int()
      .min(0)
      .optional(),
    q: z.string().trim().max(200).optional(),
    status: z
      .enum(["DRAFT", "ACTIVE", "RESERVED", "SOLD", "EXCHANGED", "REMOVED"])
      .optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    cursor: z.string().uuid().optional(),
  })
  .strict();

const categoryName = z
  .string()
  .trim()
  .min(1, "Enter a category name")
  .max(100, "Use 100 characters or fewer");

const categorySlug = z
  .string()
  .trim()
  .min(1, "Enter a category slug")
  .max(100, "Use 100 characters or fewer")
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Use lowercase letters, numbers, and hyphens only",
  );

export const categorySchema = z
  .object({ name: categoryName, slug: categorySlug })
  .strict();

export type CreateListingInput = z.infer<typeof createListingSchema>;
export type UpdateListingInput = z.infer<typeof updateListingSchema>;
export type ListListingsQuery = z.infer<typeof listListingsQuerySchema>;
export type CreateCategoryInput = z.infer<typeof categorySchema>;
