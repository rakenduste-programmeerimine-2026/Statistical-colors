// PLACEHOLDER(#40): replace with an import from src/core/analysis/types.ts once it is on main.
/** One unique colour and how often it occurs. */
export interface ColorCount {
  r: number;
  g: number;
  b: number;
  /** Alpha 0–255, only present when the analysis includes alpha. */
  a?: number;
  count: number;
  /** Share of all pixels, 0–100. */
  percent: number;
}

export interface ColorCounts {
  totalPixels: number;
  uniqueColors: number;
  /** Most frequent colours first; ties keep the order of first appearance. */
  colors: ColorCount[];
}

/**
 * Counts every unique colour in RGBA pixels (the `ImageData.data` layout).
 *
 * With `includeAlpha` false a colour is (r, g, b) and alpha is ignored, so
 * fully transparent pixels are counted by their RGB values. With
 * `includeAlpha` true a colour is (r, g, b, a).
 *
 * @throws Error if `pixels.length` is not `width * height * 4`.
 */
export function countColors(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  includeAlpha: boolean,
): ColorCounts {
  const totalPixels = width * height;
  if (pixels.length !== totalPixels * 4) {
    throw new Error(
      `Expected ${totalPixels * 4} bytes for a ${width}×${height} image, got ${pixels.length}.`,
    );
  }

  // Numeric keys avoid building millions of strings. A Map keeps insertion
  // order, i.e. the order in which each colour first appears in the image.
  const counts = new Map<number, number>();
  for (let i = 0; i < pixels.length; i += 4) {
    const rgb = (pixels[i] << 16) | (pixels[i + 1] << 8) | pixels[i + 2];
    // rgb * 256 + a stays below 2^32, well within the safe integer range.
    const key = includeAlpha ? rgb * 256 + pixels[i + 3] : rgb;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const colors: ColorCount[] = [];
  for (const [key, count] of counts) {
    const rgb = includeAlpha ? Math.floor(key / 256) : key;
    const color: ColorCount = {
      r: (rgb >> 16) & 0xff,
      g: (rgb >> 8) & 0xff,
      b: rgb & 0xff,
      count,
      percent: (count / totalPixels) * 100,
    };
    if (includeAlpha) color.a = key % 256;
    colors.push(color);
  }

  // Array.prototype.sort is stable, so equal counts keep first-appearance
  // order, like Python's Counter.most_common in the original Flask app.
  colors.sort((x, y) => y.count - x.count);

  return { totalPixels, uniqueColors: colors.length, colors };
}
