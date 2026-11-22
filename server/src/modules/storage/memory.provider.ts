import type {
  StorageProvider,
  PresignedUpload,
  ImageRecord,
} from "./storage.types.js";

/**
 * In-memory storage provider used by the test suite (`STORAGE_PROVIDER=memory`).
 * It records presigned uploads and "completes" them by creating image records,
 * so tests can exercise the full image flow without S3. Each Vitest file gets
 * its own module instance, and the test helpers clear it between cases.
 */

const pendingUploads = new Map<string, PresignedUpload>();
const objects = new Map<string, { contentType: string; bytes: Buffer }>();

export const memoryProvider: StorageProvider = {
  name: "memory",

  async presignUpload(input): Promise<PresignedUpload> {
    const key = `listings/${input.listingId}/${crypto.randomUUID()}${extensionOf(
      input.suggestedFilename,
    )}`;

    const upload: PresignedUpload = {
      key,
      url: `http://localhost/memory-upload/${key}`,
      fields: {},
      contentType: input.contentType,
    };

    pendingUploads.set(key, upload);

    return upload;
  },

  async deleteObject(key: string): Promise<void> {
    objects.delete(key);
    pendingUploads.delete(key);
  },

  publicUrl(key: string): string {
    return `http://localhost/memory-object/${key}`;
  },
};

/** Returns the pending upload for a key, if it exists. */
export function getPendingUpload(key: string): PresignedUpload | undefined {
  return pendingUploads.get(key);
}

/** Marks an upload as completed and stores its object metadata. */
export function completeUpload(
  key: string,
  metadata: { contentType: string; sizeBytes: number; width: number | null; height: number | null },
): ImageRecord {
  const upload = pendingUploads.get(key);

  if (!upload) {
    throw new Error(`No pending upload for key "${key}"`);
  }

  objects.set(key, {
    contentType: upload.contentType,
    bytes: Buffer.alloc(metadata.sizeBytes),
  });

  pendingUploads.delete(key);

  return {
    id: crypto.randomUUID(),
    key,
    url: `http://localhost/memory-object/${key}`,
    mimeType: metadata.contentType,
    sizeBytes: metadata.sizeBytes,
    width: metadata.width,
    height: metadata.height,
    position: 0,
  };
}

/** Returns all stored object keys. */
export function storedKeys(): string[] {
  return [...objects.keys()];
}

/** Clears all pending uploads and stored objects. */
export function clearStorage(): void {
  pendingUploads.clear();
  objects.clear();
}

function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf(".");

  if (dot <= 0 || dot === filename.length - 1) {
    return ".bin";
  }

  return filename.slice(dot).toLowerCase();
}
