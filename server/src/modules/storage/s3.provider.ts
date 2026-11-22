import { env } from "../../config/env.js";
import { logger } from "../../lib/logger.js";
import {
  PutObjectCommand,
  DeleteObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { StorageProvider, PresignedUpload } from "./storage.types.js";

const s3Client = new S3Client({
  endpoint: env.S3_ENDPOINT ?? undefined,
  region: env.S3_REGION,
  credentials:
    env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY
      ? {
          accessKeyId: env.S3_ACCESS_KEY_ID,
          secretAccessKey: env.S3_SECRET_ACCESS_KEY,
        }
      : undefined,
  forcePathStyle: env.S3_FORCE_PATH_STYLE ?? false,
});

const BUCKET = env.S3_BUCKET;

/**
 * S3-compatible object storage for listing images. Supports AWS S3 and any
 * S3-compatible service (MinIO, Cloudflare R2, etc.) via `S3_ENDPOINT`.
 *
 * Presigned PUT URLs let the client upload directly to S3, so the API never
 * handles raw image bytes. This keeps the API small and avoids buffering
 * multi-megabyte images in memory.
 */
export const s3Provider: StorageProvider = {
  name: "s3",

  async presignUpload(input): Promise<PresignedUpload> {
    const key = `listings/${input.listingId}/${crypto.randomUUID()}${extensionOf(
      input.suggestedFilename,
    )}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: input.contentType,
    });

    const url = await getSignedUrl(s3Client, command, {
      expiresIn: env.S3_PRESIGN_TTL_SECONDS,
    });

    return {
      key,
      url,
      fields: {},
      contentType: input.contentType,
    };
  },

  async deleteObject(key: string): Promise<void> {
    try {
      await s3Client.send(
        new DeleteObjectCommand({ Bucket: BUCKET, Key: key }),
      );
    } catch (error) {
      logger.warn({ err: error, key }, "failed to delete object from S3");
    }
  },

  publicUrl(key: string): string {
    const base = env.S3_PUBLIC_URL ?? env.S3_ENDPOINT ?? "";
    return base ? `${base.replace(/\/$/, "")}/${key}` : key;
  },
};

function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf(".");

  if (dot <= 0 || dot === filename.length - 1) {
    return ".bin";
  }

  return filename.slice(dot).toLowerCase();
}
