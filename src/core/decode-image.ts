import { detectImageFormat, type ImageFormat } from "./image-format";
import { UnsupportedImageFormatError, type PixelDecoder } from "./pixel-decoder";

export {
  ExactDecodingUnsupportedError,
  UnsupportedImageFormatError,
  type PixelDecoder,
  type RawPixels,
} from "./pixel-decoder";

export interface DecodedImage {
  width: number;
  height: number;
  format: ImageFormat;
  /** RGBA, 8 bits per channel, rows top to bottom (same layout as ImageData.data). */
  pixels: Uint8ClampedArray;
}

/** Longest signature checked by detectImageFormat (WebP: "RIFF" + size + "WEBP"). */
const SIGNATURE_LENGTH = 12;

/**
 * Decodes an image file into raw RGBA pixels without changing its colours.
 *
 * @param decoder pixel decoder to use. Inject a fake in tests.
 * @throws UnsupportedImageFormatError if the file is not PNG, JPEG, GIF, WebP or BMP.
 * @throws ExactDecodingUnsupportedError from the decoder if exact decoding is not possible.
 */
export async function decodeImage(
  file: Blob,
  decoder: PixelDecoder,
): Promise<DecodedImage> {
  const header = new Uint8Array(
    await file.slice(0, SIGNATURE_LENGTH).arrayBuffer(),
  );
  const format = detectImageFormat(header);
  if (!format) {
    throw new UnsupportedImageFormatError();
  }

  const { width, height, pixels } = await decoder.decode(file);
  if (pixels.length !== width * height * 4) {
    throw new Error(
      `Decoder returned ${pixels.length} bytes for a ${width}×${height} image (expected ${width * height * 4}).`,
    );
  }

  return { width, height, format, pixels };
}
