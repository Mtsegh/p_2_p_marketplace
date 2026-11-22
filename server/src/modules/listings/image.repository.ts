import { prisma } from "../../db/prisma.js";

/**
 * Data access for listing images. Services own business rules; this module only
 * talks to Prisma.
 */

export function findListingById(listingId: string) {
  return prisma.listing.findUnique({
    where: { id: listingId },
    select: {
      id: true,
      ownerId: true,
      status: true,
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

/**
 * Creates image records for completed uploads. Runs in a transaction so all
 * images are added atomically.
 */
export function createImages(
  listingId: string,
  images: Array<{
    key: string;
    url: string;
    mimeType: string;
    sizeBytes: number;
    width: number | null;
    height: number | null;
  }>,
) {
  return prisma.$transaction(async (tx) => {
    const count = await tx.listingImage.count({
      where: { listingId },
    });

    await tx.listingImage.createMany({
      data: images.map((image, index) => ({
        listingId,
        key: image.key,
        url: image.url,
        mimeType: image.mimeType,
        sizeBytes: image.sizeBytes,
        width: image.width,
        height: image.height,
        position: count + index,
      })),
    });

    return tx.listingImage.findMany({
      where: { listingId },
      orderBy: { position: "asc" },
    });
  });
}

/**
 * Finds an image by id so the service can check ownership before any write.
 */
export function findImageById(imageId: string) {
  return prisma.listingImage.findUnique({
    where: { id: imageId },
    select: {
      id: true,
      key: true,
      listingId: true,
    },
  });
}

/**
 * Deletes a single image record by id.
 */
export function deleteImage(imageId: string) {
  return prisma.listingImage.delete({
    where: { id: imageId },
    select: {
      id: true,
      key: true,
      listingId: true,
    },
  });
}

/**
 * Reorders images for a listing by updating their position values. Runs in a
 * transaction.
 */
export function reorderImages(listingId: string, imageIds: string[]) {
  return prisma.$transaction(
    imageIds.map((imageId, index) =>
      prisma.listingImage.update({
        where: { id: imageId, listingId },
        data: { position: index },
      }),
    ),
  );
}

/**
 * Counts images for a listing.
 */
export function countImages(listingId: string) {
  return prisma.listingImage.count({
    where: { listingId },
  });
}
