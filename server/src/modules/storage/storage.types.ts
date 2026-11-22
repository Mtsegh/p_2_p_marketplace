/**
 * A single image upload request returned by the presign endpoint. The client
 * PUTs the file directly to `url` using the given `fields`, then calls the
 * complete endpoint so the API can record the image in the database.
 */
export interface PresignedUpload {
  /** The S3 object key the client must PUT to. */
  key: string;
  /** The presigned PUT URL the client uploads to. */
  url: string;
  /** Form fields to include with the PUT request (if using multipart). */
  fields: Record<string, string>;
  /** MIME type the client must send. */
  contentType: string;
}

/**
 * A recorded image in the database, returned after the client completes the
 * upload.
 */
export interface ImageRecord {
  id: string;
  key: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  position: number;
}

/**
 * Delivery boundary for object storage. Swapping S3 for another provider means
 * adding one implementation and changing `STORAGE_PROVIDER`; nothing else talks
 * to a vendor directly.
 */
export interface StorageProvider {
  readonly name: string;

  /**
   * Returns a presigned PUT URL and object key for a client-side upload. The
   * caller supplies a suggested filename and content type; the provider picks
   * the actual key (usually a UUID + extension) so clients can't guess or
   * overwrite each other's objects.
   */
  presignUpload(input: {
    listingId: string;
    contentType: string;
    sizeBytes: number;
    suggestedFilename: string;
  }): Promise<PresignedUpload>;

  /**
   * Deletes an object from storage by key. Called when an image is removed
   * from a listing or the listing itself is deleted.
   */
  deleteObject(key: string): Promise<void>;

  /**
   * Returns the public URL for an object key, used when building image records
   * after a completed upload.
   */
  publicUrl(key: string): string;
}
