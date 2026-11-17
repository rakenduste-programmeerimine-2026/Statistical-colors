/**
 * Port for turning an image file into raw RGBA pixels.
 *
 * Implementations must return the pixel values exactly as stored in the file:
 * no colour profile conversion and no premultiplied alpha.
 * Pixels are RGBA, 8 bits per channel, rows ordered top to bottom
 * (the same layout as `ImageData.data`).
 */
export interface PixelDecoder {
  decode(file: Blob): Promise<RawPixels>;
}

export interface RawPixels {
  width: number;
  height: number;
  pixels: Uint8ClampedArray;
}

export class UnsupportedImageFormatError extends Error {
  constructor() {
    super(
      "Unsupported image format. Supported formats are PNG, JPEG, GIF, WebP and BMP.",
    );
    this.name = "UnsupportedImageFormatError";
  }
}

/**
 * The browser cannot decode the image without changing its colours
 * (it ignores `colorSpaceConversion: "none"` or `premultiplyAlpha: "none"`).
 */
export class ExactDecodingUnsupportedError extends Error {
  constructor(message = "This browser cannot decode images without changing their colours.") {
    super(message);
    this.name = "ExactDecodingUnsupportedError";
  }
}
