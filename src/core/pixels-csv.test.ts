import { describe, expect, it, vi } from "vitest";
import { pixelsCsv } from "@/adapters/stub/stub-csv";
import { buildPixelsCsv, PIXELS_CSV_CHUNK_ROWS } from "./pixels-csv";
import { SUMMARY_CSV_TYPE } from "./summary-csv";

const noPause = () => Promise.resolve();

/** Deterministic RGBA pixels covering every channel value. */
function image(count: number): Uint8ClampedArray {
  return Uint8ClampedArray.from({ length: count * 4 }, (_, i) => (i * 37) % 256);
}

/** Straightforward one-string reference: the same rows the stub writes. */
function reference(pixels: Uint8ClampedArray, width: number, includeAlpha: boolean): string {
  let out = includeAlpha ? "x,y,r,g,b,a\r\n" : "x,y,r,g,b\r\n";
  for (let i = 0; i < pixels.length; i += 4) {
    const p = i / 4;
    const row = [p % width, Math.floor(p / width), pixels[i], pixels[i + 1], pixels[i + 2]];
    if (includeAlpha) row.push(pixels[i + 3]);
    out += row.join(",") + "\r\n";
  }
  return out;
}

describe("buildPixelsCsv", () => {
  it("writes the stub's format: one row per pixel, row by row, CRLF", async () => {
    // Four unique colours with count 1 make the stub lay them out in pixel order.
    const colors = [
      { r: 255, g: 0, b: 16, a: 255, count: 1, percent: 25 },
      { r: 1, g: 2, b: 3, a: 128, count: 1, percent: 25 },
      { r: 0, g: 0, b: 0, a: 0, count: 1, percent: 25 },
      { r: 9, g: 99, b: 199, a: 7, count: 1, percent: 25 },
    ];
    const pixels = Uint8ClampedArray.from(colors.flatMap((c) => [c.r, c.g, c.b, c.a]));
    const analysis = { id: "t", fileName: "t.png", width: 2, height: 2, totalPixels: 4, uniqueColors: 4, topN: 4, colors };

    for (const includeAlpha of [true, false]) {
      const blob = await buildPixelsCsv(pixels, 2, 2, includeAlpha, noPause);
      expect(await blob.text()).toBe(pixelsCsv({ ...analysis, includeAlpha }));
    }
  });

  it("leaves alpha out in RGB mode", async () => {
    const blob = await buildPixelsCsv(Uint8ClampedArray.from([1, 2, 3, 4]), 1, 1, false, noPause);
    expect(await blob.text()).toBe("x,y,r,g,b\r\n0,0,1,2,3\r\n");
  });

  it("writes only the header for an image without pixels", async () => {
    const blob = await buildPixelsCsv(new Uint8ClampedArray(0), 0, 0, true, noPause);
    expect(await blob.text()).toBe("x,y,r,g,b,a\r\n");
  });

  it("has the type the reports bucket allows", async () => {
    expect((await buildPixelsCsv(image(1), 1, 1, false, noPause)).type).toBe(SUMMARY_CSV_TYPE);
  });

  const CHUNK = PIXELS_CSV_CHUNK_ROWS;
  it.each([
    // width, height, pauses between chunks
    [CHUNK - 1, 1, 0],
    [CHUNK, 1, 0],
    [CHUNK + 1, 1, 1],
    [256, CHUNK / 256 - 1, 0],
    [256, CHUNK / 256 + 1, 1],
    [256, (2 * CHUNK) / 256, 1],
    [2 * CHUNK + 1, 1, 2],
  ])("joins a %i×%i image across chunk boundaries without a gap, pausing %i times", async (width, height, pauses) => {
    const pixels = image(width * height);
    const pause = vi.fn(noPause);
    const blob = await buildPixelsCsv(pixels, width, height, true, pause);
    expect(await blob.text()).toBe(reference(pixels, width, true));
    expect(pause).toHaveBeenCalledTimes(pauses);
  });

  it("rejects a buffer that does not match the size", async () => {
    await expect(buildPixelsCsv(image(3), 2, 2, false, noPause)).rejects.toThrow("Expected 16 bytes");
  });
});
