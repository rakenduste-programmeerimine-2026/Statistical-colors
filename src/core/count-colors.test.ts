import { describe, expect, it } from "vitest";
import { countColors } from "./count-colors";

type Rgba = [number, number, number, number];

function pixelsOf(...colors: Rgba[]) {
  return new Uint8ClampedArray(colors.flat());
}

describe("countColors", () => {
  it("counts a single pixel", () => {
    const result = countColors(pixelsOf([10, 20, 30, 255]), 1, 1, false);

    expect(result).toEqual({
      totalPixels: 1,
      uniqueColors: 1,
      colors: [{ r: 10, g: 20, b: 30, count: 1, percent: 100 }],
    });
  });

  it("counts an image of one colour as a single entry", () => {
    const red: Rgba = [255, 0, 0, 255];
    const result = countColors(pixelsOf(red, red, red, red, red, red), 3, 2, false);

    expect(result.totalPixels).toBe(6);
    expect(result.uniqueColors).toBe(1);
    expect(result.colors).toEqual([{ r: 255, g: 0, b: 0, count: 6, percent: 100 }]);
  });

  describe("with alpha off", () => {
    it.each([0, 1, 255])("ignores alpha %i and leaves out `a`", (alpha) => {
      const result = countColors(pixelsOf([1, 2, 3, alpha]), 1, 1, false);

      expect(result.colors).toEqual([{ r: 1, g: 2, b: 3, count: 1, percent: 100 }]);
      expect(result.colors[0]).not.toHaveProperty("a");
    });

    it("merges pixels with the same RGB and different alpha, including 0", () => {
      const pixels = pixelsOf([1, 2, 3, 0], [1, 2, 3, 1], [1, 2, 3, 255]);

      expect(countColors(pixels, 3, 1, false).colors).toEqual([
        { r: 1, g: 2, b: 3, count: 3, percent: 100 },
      ]);
    });
  });

  describe("with alpha on", () => {
    it.each([0, 1, 255])("keeps alpha %i as `a`", (alpha) => {
      const result = countColors(pixelsOf([1, 2, 3, alpha]), 1, 1, true);

      expect(result.colors).toEqual([{ r: 1, g: 2, b: 3, a: alpha, count: 1, percent: 100 }]);
    });

    it("counts the same RGB with alpha 0, 1 and 255 as three colours", () => {
      const result = countColors(pixelsOf([1, 2, 3, 0], [1, 2, 3, 1], [1, 2, 3, 255]), 3, 1, true);

      expect(result.uniqueColors).toBe(3);
      expect(result.colors.map((c) => c.a)).toEqual([0, 1, 255]);
    });

    it("decodes the extreme channel values", () => {
      const result = countColors(pixelsOf([255, 255, 255, 255], [0, 0, 0, 0]), 2, 1, true);

      expect(result.colors).toEqual([
        { r: 255, g: 255, b: 255, a: 255, count: 1, percent: 50 },
        { r: 0, g: 0, b: 0, a: 0, count: 1, percent: 50 },
      ]);
    });
  });

  it("sorts by count descending and keeps first-seen order for equal counts", () => {
    const a: Rgba = [1, 0, 0, 255];
    const b: Rgba = [2, 0, 0, 255];
    const c: Rgba = [3, 0, 0, 255];
    const d: Rgba = [4, 0, 0, 255];
    // Counts: c 1, b 2, d 2, a 3. First seen: c, b, d, a.
    const result = countColors(pixelsOf(c, b, d, a, b, a, d, a), 4, 2, false);

    expect(result.colors.map((x) => [x.r, x.count])).toEqual([
      [1, 3],
      [2, 2],
      [4, 2],
      [3, 1],
    ]);
  });

  it("keeps counts summing to totalPixels and percentages to about 100", () => {
    const width = 7;
    const height = 3;
    const pixels = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < pixels.length; i += 4) {
      pixels.set([(i / 4) % 5, 0, (i / 4) % 3, 255], i);
    }

    const result = countColors(pixels, width, height, false);

    expect(result.uniqueColors).toBe(15);
    expect(result.colors.reduce((s, c) => s + c.count, 0)).toBe(21);
    expect(result.colors.reduce((s, c) => s + c.percent, 0)).toBeCloseTo(100, 10);
    for (const c of result.colors) expect(c.percent).toBe((c.count / 21) * 100);
  });

  it.each([
    ["one byte short", 2 * 2 * 4 - 1],
    ["one byte too many", 2 * 2 * 4 + 1],
    ["one pixel short", 3 * 4],
    ["empty", 0],
  ])("throws when pixels.length is wrong (%s)", (_name, length) => {
    expect(() => countColors(new Uint8ClampedArray(length), 2, 2, false)).toThrow(
      "Expected 16 bytes for a 2×2 image",
    );
  });
});
