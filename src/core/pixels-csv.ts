import { SUMMARY_CSV_TYPE } from "@/core/summary-csv";

/** Pixels joined into one string at a time; the strings become Blob parts. */
export const PIXELS_CSV_CHUNK_ROWS = 65536;

/** The original used Python's csv "excel" dialect: comma separated, CRLF line endings. */
const EOL = "\r\n";

/** Lets the browser handle input between chunks, so a large image does not freeze the page. */
const nextTask = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/**
 * Pixel-by-pixel CSV (#38): header `x,y,r,g,b` or `x,y,r,g,b,a`, one row per
 * pixel, row by row from the top left. Built in chunks of
 * PIXELS_CSV_CHUNK_ROWS pixels, each one Blob part, because a large image
 * would exceed the maximum string length.
 *
 * @param pixels RGBA, 8 bits per channel (the `ImageData.data` layout)
 * @param pause awaited between chunks; inject a fake in tests
 * @throws Error if `pixels.length` is not `width * height * 4`
 */
export async function buildPixelsCsv(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  includeAlpha: boolean,
  pause: () => Promise<void> = nextTask,
): Promise<Blob> {
  const total = width * height;
  if (pixels.length !== total * 4) {
    throw new Error(`Expected ${total * 4} bytes for a ${width}×${height} image, got ${pixels.length}.`);
  }
  const parts: string[] = [(includeAlpha ? "x,y,r,g,b,a" : "x,y,r,g,b") + EOL];
  for (let start = 0; start < total; start += PIXELS_CSV_CHUNK_ROWS) {
    if (start > 0) await pause();
    const end = Math.min(start + PIXELS_CSV_CHUNK_ROWS, total);
    const rows: string[] = [];
    for (let p = start; p < end; p++) {
      const i = p * 4;
      const rgb = `${p % width},${Math.floor(p / width)},${pixels[i]},${pixels[i + 1]},${pixels[i + 2]}`;
      rows.push(includeAlpha ? `${rgb},${pixels[i + 3]}${EOL}` : rgb + EOL);
    }
    parts.push(rows.join(""));
  }
  return new Blob(parts, { type: SUMMARY_CSV_TYPE });
}
