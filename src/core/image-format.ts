/**
 * Image formats the app can decode in the browser.
 *
 * NB! These values must match the `images.format` column in the database
 * (check constraint: 'png', 'jpeg', 'bmp', 'gif', 'webp', 'tiff').
 * 'tiff' is allowed by the schema but intentionally not supported here,
 * because browsers cannot decode TIFF.
 */
export const IMAGE_FORMATS = ["png", "jpeg", "gif", "webp", "bmp"] as const;

export type ImageFormat = (typeof IMAGE_FORMATS)[number];

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];
const GIF87A_SIGNATURE = [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]; // "GIF87a"
const GIF89A_SIGNATURE = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]; // "GIF89a"
const RIFF_SIGNATURE = [0x52, 0x49, 0x46, 0x46]; // "RIFF"
const WEBP_SIGNATURE = [0x57, 0x45, 0x42, 0x50]; // "WEBP" at offset 8
const BMP_SIGNATURE = [0x42, 0x4d]; // "BM"

function startsWith(
  bytes: Uint8Array,
  signature: readonly number[],
  offset = 0,
): boolean {
  if (bytes.length < offset + signature.length) {
    return false;
  }
  return signature.every((byte, i) => bytes[offset + i] === byte);
}

/**
 * Detects the image format from the file signature (magic bytes),
 * not from the file name or MIME type.
 *
 * Returns `null` for empty, too short or unrecognised input.
 */
export function detectImageFormat(bytes: Uint8Array): ImageFormat | null {
  if (startsWith(bytes, PNG_SIGNATURE)) {
    return "png";
  }
  if (startsWith(bytes, JPEG_SIGNATURE)) {
    return "jpeg";
  }
  if (
    startsWith(bytes, GIF87A_SIGNATURE) ||
    startsWith(bytes, GIF89A_SIGNATURE)
  ) {
    return "gif";
  }
  // RIFF alone is not enough: WAV and AVI files are RIFF containers too.
  if (startsWith(bytes, RIFF_SIGNATURE) && startsWith(bytes, WEBP_SIGNATURE, 8)) {
    return "webp";
  }
  if (startsWith(bytes, BMP_SIGNATURE)) {
    return "bmp";
  }
  return null;
}
