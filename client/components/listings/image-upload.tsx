"use client";

import { useCallback, useState, type ChangeEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { ApiError } from "@/lib/api";
import { stripExif } from "@/lib/image-processing";
import {
  completeListingImage,
  presignListingImage,
} from "@/lib/listings-api";

const MAX_FILE_BYTES = 8 * 1_024 * 1_024; // 8 MiB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

interface ImageUploadProps {
  listingId: string;
  onImageAdded: (image: { id: string; url: string }) => void;
  className?: string;
}

/**
 * Handles image upload for a listing. The user selects a file, EXIF metadata
 * is stripped by re-encoding it in the browser, the component requests a
 * presigned URL from the API, uploads the sanitized blob directly to object
 * storage, then confirms the upload with the API.
 */
export function ImageUpload({
  listingId,
  onImageAdded,
  className,
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];

      if (!file) {
        return;
      }

      setError(null);

      // Client-side validation before hitting the API.
      if (!ALLOWED_TYPES.includes(file.type)) {
        setError("Unsupported file type. Use JPEG, PNG, WebP, or GIF.");
        return;
      }

      if (file.size > MAX_FILE_BYTES) {
        setError(
          `File is too large. Maximum ${MAX_FILE_BYTES / 1_024 / 1_024} MiB.`,
        );
        return;
      }

      setUploading(true);

      try {
        // Strip EXIF (including GPS location) before the file leaves the browser.
        const sanitized = await stripExif(file);
        const contentType = sanitized.type || file.type;
        const filename = `image.${contentType.split("/")[1] ?? "webp"}`;

        // Step 1: Get a presigned PUT URL from the API.
        const upload = await presignListingImage({
          listingId,
          contentType,
          sizeBytes: sanitized.size,
          suggestedFilename: filename,
        });

        // Step 2: Upload the sanitized file directly to object storage.
        await fetch(upload.url, {
          method: "PUT",
          body: sanitized,
          headers: { "Content-Type": contentType },
        });

        // Step 3: Confirm the upload with the API so the image is recorded.
        const image = await completeListingImage({
          listingId,
          key: upload.key,
        });

        onImageAdded({ id: image.id, url: image.url });

        // Reset the file input so the same file can be selected again.
        event.target.value = "";
      } catch (caught) {
        setError(
          caught instanceof ApiError
            ? caught.message
            : "Something went wrong. Check your connection and try again.",
        );
      } finally {
        setUploading(false);
      }
    },
    [listingId, onImageAdded],
  );

  return (
    <div className={className}>
      {error ? (
        <Alert tone="danger" title="Upload failed">{error}</Alert>
      ) : null}

      <label className="flex items-center justify-center gap-2 rounded-md border-2 border-dashed border-line bg-surface px-4 py-3 text-sm text-muted hover:border-primary hover:text-primary cursor-pointer transition-colors">
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={handleFileSelect}
          className="sr-only"
        />
        {uploading ? (
          <span className="flex items-center gap-2 animate-pulse">
            <span className="h-3 w-3 rounded-full bg-primary" /> Uploading…
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <span className="h-4 w-4 rounded-full border border-current border-2" />
            <span>Add photo</span>
          </span>
        )}
      </label>
    </div>
  );
}
