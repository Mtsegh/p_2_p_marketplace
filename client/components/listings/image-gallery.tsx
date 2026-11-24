"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import { deleteListingImage } from "@/lib/listings-api";

interface ImageItemProps {
  image: {
    id: string;
    url: string;
    key: string;
  };
  onDelete: () => void;
  isDeleting: boolean;
}

/**
 * A single image in the listing gallery, shown as a thumbnail with a delete
 * button.
 */
function ImageItem({
  image,
  onDelete,
  isDeleting,
}: ImageItemProps) {
  return (
    <div className="relative group">
      {/* Image host comes from runtime S3/CDN config (and a fake host in tests),
          so next/image cannot be given a config-time remotePattern here. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image.url}
        alt="Listing image"
        className="w-24 h-24 rounded-lg object-cover border border-line"
      />
      <Button
        variant="danger"
        size="sm"
        onClick={onDelete}
        loading={isDeleting}
        className="absolute top-1 right-1 -mx-1 -my-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100"
        aria-label="Delete image"
      >
        &times;
      </Button>
    </div>
  );
}

interface ImageGalleryProps {
  images: Array<{
    id: string;
    url: string;
    key: string;
    position: number;
  }>;
  listingId: string;
  onImageDeleted: () => void;
}

/**
 * Displays a grid of listing images, each with a delete button on hover.
 */
export function ImageGallery({
  images,
  listingId,
  onImageDeleted,
}: ImageGalleryProps) {
  const [deleting, setDeleting] = useState<string | null>(null);

  const handleDelete = async (imageId: string) => {
    setDeleting(imageId);

    try {
      await deleteListingImage({ listingId, imageId });
      onImageDeleted();
    } catch (caught) {
      setDeleting(null);
      throw caught instanceof ApiError
        ? caught
        : new Error("Something went wrong. Check your connection and try again.");
    } finally {
      setDeleting(null);
    }
  };

  if (images.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      {images.map((image) => (
        <ImageItem
          key={image.id}
          image={image}
          onDelete={() => {
            handleDelete(image.id).catch(() => {
              // Error is surfaced by the alert in the parent form
            });
          }}
          isDeleting={deleting === image.id}
        />
      ))}
    </div>
  );
}
