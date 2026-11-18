/** An image decoded to its stored 8-bit sRGB values, kept at its own size. */
export interface DecodedImage {
  width: number;
  height: number;
  /** Unscaled copy to draw from. */
  source: CanvasImageSource;
  /** RGBA, 4 bytes per pixel, row by row. */
  pixels: Uint8ClampedArray;
}

/**
 * Largest image the preview decodes: 4096 × 4096 (about 16.7 MP, 64 MB per RGBA
 * copy). It is the iOS Safari canvas limit and covers 5K screenshots. Larger
 * images would cost hundreds of MB and can exceed browser canvas limits
 * (performance-analyst, #42). The analysis itself is not limited by this.
 */
export const MAX_PREVIEW_PIXELS = 4096 * 4096;

export class PreviewTooLargeError extends Error {
  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    super(`${width} × ${height} is larger than the preview limit.`);
    this.name = "PreviewTooLargeError";
  }
}

/**
 * Decodes with the browser (library audit, P-020 item 6). "none" keeps the stored
 * values: no colour-profile conversion and no premultiplied alpha. There is no
 * fallback without these options, because that would not be exact.
 */
export async function decodeImage(blob: Blob): Promise<DecodedImage> {
  const bitmap = await createImageBitmap(blob, { colorSpaceConversion: "none", premultiplyAlpha: "none" });
  try {
    // Checked before the full-size canvas and pixel copy are made.
    if (bitmap.width * bitmap.height > MAX_PREVIEW_PIXELS) throw new PreviewTooLargeError(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Canvas 2D is not available.");
    ctx.drawImage(bitmap, 0, 0);
    const { data } = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
    return { width: bitmap.width, height: bitmap.height, source: canvas, pixels: data };
  } finally {
    bitmap.close();
  }
}
