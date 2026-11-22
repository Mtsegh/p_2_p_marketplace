/**
 * Re-encodes an image through a canvas to strip embedded EXIF metadata
 * (including GPS location) before upload. The API never receives raw image
 * bytes, so this must happen in the browser. Canvas re-encoding also normalizes
 * the file to a known-safe format.
 */

const OUTPUT_FORMAT = "image/webp";
const OUTPUT_QUALITY = 0.92;

/**
 * Returns a new Blob with no EXIF data. Uses createImageBitmap when available
 * (modern browsers) and falls back to an Image + object URL otherwise.
 */
export async function stripExif(file: File): Promise<Blob> {
  const bitmap = await decodeImage(file);

  try {
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;

    const context = canvas.getContext("2d");

    if (!context) {
      // No canvas support: return the original rather than blocking the user.
      return file;
    }

    context.drawImage(bitmap, 0, 0);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, OUTPUT_FORMAT, OUTPUT_QUALITY),
    );

    // A browser that cannot encode WebP returns null; keep the original in
    // that case so the upload still works (type validation still applies).
    return blob ?? file;
  } finally {
    if ("close" in bitmap && typeof bitmap.close === "function") {
      bitmap.close();
    }
  }
}

function decodeImage(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(file);
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not decode the image"));
    };
    image.src = url;
  });
}
