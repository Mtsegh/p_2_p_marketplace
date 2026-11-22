import { AppError } from "../../lib/app-error.js";
import { storageProvider } from "../storage/storage.provider.js";
import * as repository from "./image.repository.js";
import type {
  CompleteUploadInput,
  PresignUploadInput,
  ReorderImagesInput,
} from "./image.schemas.js";

const MAX_IMAGES_PER_LISTING = 10;

/**
 * Handles listing image uploads via presigned URLs. The client uploads
 * directly to object storage, then calls complete to record the image in the
 * database. The API never handles raw image bytes.
 */

export async function presignUpload(
  userId: string,
  input: PresignUploadInput,
) {
  const listing = await repository.findListingById(input.listingId);

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

  // A listing in a deal cannot be changed.
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

  const imageCount = await repository.countImages(input.listingId);

  if (imageCount >= MAX_IMAGES_PER_LISTING) {
    throw new AppError(
      "IMAGE_LIMIT_REACHED",
      409,
      "Maximum 10 images per listing",
    );
  }

  return storageProvider.presignUpload({
    listingId: input.listingId,
    contentType: input.contentType,
    sizeBytes: input.sizeBytes,
    suggestedFilename: input.suggestedFilename,
  });
}

export async function completeUpload(
  userId: string,
  listingId: string,
  input: CompleteUploadInput,
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

  // Enforce the limit here too: a caller could skip presign and call complete
  // directly, so the presign check alone is not enough.
  const imageCount = await repository.countImages(listingId);

  if (imageCount >= MAX_IMAGES_PER_LISTING) {
    throw new AppError(
      "IMAGE_LIMIT_REACHED",
      409,
      "Maximum 10 images per listing",
    );
  }

  const created = await repository.createImages(listing.id, [
    {
      key: input.key,
      url: storageProvider.publicUrl(input.key),
      mimeType: "application/octet-stream",
      sizeBytes: 0,
      width: null,
      height: null,
    },
  ]);

  return created[created.length - 1];
}

export async function deleteListingImage(userId: string, imageId: string) {
  // Load the image first, then check ownership before any destructive write.
  const image = await repository.findImageById(imageId);

  if (!image) {
    throw AppError.notFound("Image not found");
  }

  const listing = await repository.findListingById(image.listingId);

  if (!listing || listing.ownerId !== userId) {
    throw new AppError(
      "FORBIDDEN",
      403,
      "You do not own this image",
    );
  }

  // Ownership confirmed: delete the record and the stored object.
  await repository.deleteImage(imageId);
  await storageProvider.deleteObject(image.key);

  return image;
}

export async function reorderListingImages(
  userId: string,
  listingId: string,
  input: ReorderImagesInput,
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

  return repository.reorderImages(listingId, input.imageIds);
}
