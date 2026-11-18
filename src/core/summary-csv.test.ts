import { describe, expect, it } from "vitest";
import { summaryCsv } from "@/adapters/stub/stub-csv";
import type { ColorCount } from "@/core/analysis/types";
import { buildSummaryCsv, SUMMARY_CSV_CHUNK_ROWS, SUMMARY_CSV_TYPE } from "./summary-csv";

const HEADER_RGB = "r,g,b,count,percent,hex_rgb\r\n";
const HEADER_RGBA = "r,g,b,a,count,percent,hex_rgba\r\n";

/** The stub's summaryCsv is the reference format (old Flask "excel" dialect). */
function reference(colors: ColorCount[], includeAlpha: boolean): string {
  return summaryCsv({
    id: "test",
    fileName: "test.png",
    width: 1,
    height: 1,
    totalPixels: 1,
    uniqueColors: colors.length,
    includeAlpha,
    topN: colors.length,
    colors,
  });
}

/** Deterministic colours covering every channel value; percent with many decimals. */
function manyColors(n: number, withAlpha: boolean): ColorCount[] {
  return Array.from({ length: n }, (_, i) => ({
    r: i % 256,
    g: (i * 7) % 256,
    b: (i * 13) % 256,
    ...(withAlpha ? { a: (i * 31) % 256 } : {}),
    count: n - i,
    percent: (100 * (n - i)) / ((n * (n + 1)) / 2),
  }));
}

async function text(colors: ColorCount[], includeAlpha: boolean, maxBytes?: number) {
  const blob = buildSummaryCsv(colors, includeAlpha, maxBytes);
  expect(blob).not.toBeNull();
  return blob!.text();
}

describe("buildSummaryCsv", () => {
  it("has the bucket's MIME type", () => {
    expect(SUMMARY_CSV_TYPE).toBe("text/csv");
    expect(buildSummaryCsv([], false)?.type).toBe("text/csv");
    expect(buildSummaryCsv(manyColors(3, true), true)?.type).toBe("text/csv");
  });

  it("writes only the header for an empty list", async () => {
    expect(await text([], false)).toBe(HEADER_RGB);
    expect(await text([], true)).toBe(HEADER_RGBA);
    expect(await text([], false)).toBe(reference([], false));
    expect(await text([], true)).toBe(reference([], true));
  });

  it("writes one RGB colour", async () => {
    const colors = [{ r: 10, g: 20, b: 30, count: 1, percent: 100 }];
    expect(await text(colors, false)).toBe(`${HEADER_RGB}10,20,30,1,100.0000000000,#0A141E\r\n`);
  });

  it("writes one RGBA colour, alpha as a 3-digit decimal", async () => {
    const colors = [{ r: 10, g: 20, b: 30, a: 7, count: 1, percent: 100 }];
    expect(await text(colors, true)).toBe(`${HEADER_RGBA}10,20,30,7,1,100.0000000000,#0A141E 007\r\n`);
  });

  it("writes channel extremes 0 and 255", async () => {
    const colors = [
      { r: 0, g: 0, b: 0, a: 0, count: 1, percent: 50 },
      { r: 255, g: 255, b: 255, a: 255, count: 1, percent: 50 },
    ];
    expect(await text(colors, true)).toBe(
      `${HEADER_RGBA}0,0,0,0,1,50.0000000000,#000000 000\r\n` +
        `255,255,255,255,1,50.0000000000,#FFFFFF 255\r\n`,
    );
    expect(await text(colors, false)).toBe(
      `${HEADER_RGB}0,0,0,1,50.0000000000,#000000\r\n255,255,255,1,50.0000000000,#FFFFFF\r\n`,
    );
  });

  it("uses alpha 255 when alpha is on but a colour has none, like the stub", async () => {
    const colors = [{ r: 1, g: 2, b: 3, count: 1, percent: 100 }];
    expect(await text(colors, true)).toBe(`${HEADER_RGBA}1,2,3,255,1,100.0000000000,#010203 255\r\n`);
    expect(await text(colors, true)).toBe(reference(colors, true));
  });

  it("ignores alpha when alpha is off", async () => {
    const colors = [{ r: 1, g: 2, b: 3, a: 9, count: 1, percent: 100 }];
    expect(await text(colors, false)).toBe(reference(colors, false));
  });

  it("writes percent with exactly 10 decimals", async () => {
    const colors = [
      { r: 1, g: 1, b: 1, count: 1, percent: 1 / 3 },
      { r: 2, g: 2, b: 2, count: 1, percent: 0.00000000004 },
      { r: 3, g: 3, b: 3, count: 1, percent: 0 },
    ];
    const lines = (await text(colors, false)).split("\r\n");
    expect(lines.slice(1, 4).map((l) => l.split(",")[4])).toEqual([
      "0.3333333333",
      "0.0000000000",
      "0.0000000000",
    ]);
  });

  it("keeps the given order and writes every colour, not only a top N", async () => {
    const colors = manyColors(6000, false);
    const lines = (await text(colors, false)).split("\r\n");
    expect(lines).toHaveLength(1 + 6000 + 1); // header, rows, empty after the final CRLF
    expect(lines[1]).toBe("0,0,0,6000,0.0333277787,#000000");
    expect(lines[6000]).toMatch(/^111,9,163,1,/);
  });

  describe("is byte for byte the stub's summaryCsv across chunk boundaries", () => {
    const sizes = [
      1,
      SUMMARY_CSV_CHUNK_ROWS - 1,
      SUMMARY_CSV_CHUNK_ROWS,
      SUMMARY_CSV_CHUNK_ROWS + 1,
      2 * SUMMARY_CSV_CHUNK_ROWS + 1,
    ];
    for (const n of sizes) {
      for (const includeAlpha of [false, true]) {
        it(`${n} colours, includeAlpha ${includeAlpha}`, async () => {
          const colors = manyColors(n, includeAlpha);
          expect(await text(colors, includeAlpha)).toBe(reference(colors, includeAlpha));
        });
      }
    }
  });

  describe("maxBytes", () => {
    const colors = manyColors(SUMMARY_CSV_CHUNK_ROWS + 1, true);
    const full = reference(colors, true);

    it("has no limit without maxBytes", async () => {
      expect(await text(colors, true)).toBe(full);
    });

    it("returns the CSV when it is exactly at the limit", async () => {
      const blob = buildSummaryCsv(colors, true, full.length);
      expect(blob?.size).toBe(full.length);
      expect(await blob?.text()).toBe(full);
    });

    it("returns null when it is 1 byte over the limit", () => {
      expect(buildSummaryCsv(colors, true, full.length - 1)).toBeNull();
    });

    it("stops early when the limit is passed in the first chunk", () => {
      expect(buildSummaryCsv(colors, true, HEADER_RGBA.length + 1)).toBeNull();
    });

    it("applies the limit to the header alone", () => {
      expect(buildSummaryCsv([], false, HEADER_RGB.length)?.size).toBe(HEADER_RGB.length);
      expect(buildSummaryCsv([], false, HEADER_RGB.length - 1)).toBeNull();
    });
  });
});
