import { z } from "zod";

/**
 * The client duplicates these rules for inline validation. Keep the shapes in
 * sync when either side changes; there is no shared package by design.
 */

const MAX_FILE_BYTES = 8 * 1_024 * 1_024; // 8 MiB
const MAX_IMAGES_PER_LISTING = 10;

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

export const presignUploadSchema = z
  .object({
    listingId: z.string().uuid("Listing id must be a UUID"),
    contentType: z.enum([
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
    ]),
    sizeBytes: z
      .number()
      .int()
      .min(1, "File is empty")
      .max(MAX_FILE_BYTES, `File is too large (max ${MAX_FILE_BYTES / 1_024 / 1_024} MiB)`),
    suggestedFilename: z
      .string()
      .trim()
      .min(1, "Enter a filename")
      .max(255, "Filename is too long"),
  })
  .strict();

export const completeUploadSchema = z
  .object({
    key: z.string().min(1, "Object key is required"),
  })
  .strict();

export const listingIdParamsSchema = z
  .object({
    listingId: z.string().uuid("Listing id must be a UUID"),
  })
  .strict();

export const imageIdParamsSchema = z
  .object({
    imageId: z.string().uuid("Image id must be a UUID"),
  })
  .strict();

export const listingAndImageIdParamsSchema = z
  .object({
    listingId: z.string().uuid("Listing id must be a UUID"),
    imageId: z.string().uuid("Image id must be a UUID"),
  })
  .strict();

export const reorderImagesSchema = z
  .object({
    imageIds: z
      .array(z.string().uuid("Image id must be a UUID"))
      .min(1, "At least one image id is required")
      .max(MAX_IMAGES_PER_LISTING, `Maximum ${MAX_IMAGES_PER_LISTING} images per listing`),
  })
  .strict();

export type PresignUploadInput = z.infer<typeof presignUploadSchema>;
export type CompleteUploadInput = z.infer<typeof completeUploadSchema>;
export type ReorderImagesInput = z.infer<typeof reorderImagesSchema>;

export { MAX_IMAGES_PER_LISTING, ALLOWED_MIME_TYPES };
