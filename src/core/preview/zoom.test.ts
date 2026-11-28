import { describe, expect, it } from "vitest";
import { accumulateWheel, centered, clampLevel, fit, ONE_TO_ONE, pixelAt, ZOOM_LEVELS, zoomAt, zoomFactor, zoomLabel, wheelPixels } from "./zoom";

const last = ZOOM_LEVELS.length - 1;
const image = { width: 512, height: 40 };

describe("zoom levels", () => {
  it.each([
    [-1, 0],
    [0, 0],
    [last, last],
    [last + 1, last],
  ])("clamps level %i to %i", (level, expected) => {
    expect(clampLevel(level)).toBe(expected);
  });

  it("maps levels to factors and labels", () => {
    expect(zoomFactor(ONE_TO_ONE)).toBe(1);
    expect(zoomLabel(ONE_TO_ONE)).toBe("1×");
    expect(zoomFactor(0)).toBe(1 / 8);
    expect(zoomLabel(0)).toBe("1/8");
    expect(zoomFactor(last)).toBe(64);
  });
});

describe("fit", () => {
  it("picks the largest whole-number zoom that fits and centres it", () => {
    // 512 × 2 = 1024 fits in 1100; 512 × 3 does not.
    expect(fit(image, { width: 1100, height: 400 })).toEqual({
      level: ONE_TO_ONE + 1,
      ox: 38,
      oy: 160,
    });
  });

  it("fits exactly at the boundary", () => {
    expect(fit(image, { width: 1024, height: 80 }).level).toBe(ONE_TO_ONE + 1);
    expect(fit(image, { width: 1023, height: 80 }).level).toBe(ONE_TO_ONE);
  });

  it("zooms out without blending when the image is larger than the view", () => {
    expect(zoomLabel(fit(image, { width: 256, height: 100 }).level)).toBe("1/2");
  });

  it("falls back to the smallest level when nothing fits", () => {
    expect(fit({ width: 10_000, height: 10 }, { width: 100, height: 100 }).level).toBe(0);
  });
});

describe("zoomAt", () => {
  it("keeps the anchored image point under the cursor", () => {
    const start = centered(ONE_TO_ONE, image, { width: 600, height: 100 });
    const anchor = { x: 300, y: 50 };
    const before = pixelAt(start, anchor.x, anchor.y, image);
    const after = zoomAt(start, ONE_TO_ONE + 4, anchor.x, anchor.y);
    expect(pixelAt(after, anchor.x, anchor.y, image)).toEqual(before);
    expect(Number.isInteger(after.ox) && Number.isInteger(after.oy)).toBe(true);
  });

  it("clamps the level", () => {
    expect(zoomAt({ level: last, ox: 0, oy: 0 }, last + 3, 0, 0).level).toBe(last);
  });
});

describe("pixelAt", () => {
  const view = { level: ONE_TO_ONE + 3, ox: 10, oy: 20 }; // 4×

  it("finds the pixel under a point", () => {
    expect(pixelAt(view, 10, 20, image)).toEqual({ x: 0, y: 0 });
    expect(pixelAt(view, 13.9, 23.9, image)).toEqual({ x: 0, y: 0 });
    expect(pixelAt(view, 14, 24, image)).toEqual({ x: 1, y: 1 });
    expect(pixelAt(view, 10 + 512 * 4 - 1, 20 + 40 * 4 - 1, image)).toEqual({
      x: 511,
      y: 39,
    });
  });

  it.each([
    [9, 20],
    [10, 19],
    [10 + 512 * 4, 20],
    [10, 20 + 40 * 4],
  ])("returns null outside the image at (%d, %d)", (x, y) => {
    expect(pixelAt(view, x, y, image)).toBeNull();
  });
});

describe("wheel accumulation (#90)", () => {
  it("moves one level per mouse notch, as before", () => {
    expect(accumulateWheel(0, -100)).toEqual({ levels: 1, rest: 0 });
    expect(accumulateWheel(0, 100)).toEqual({ levels: -1, rest: 0 });
  });

  it("collects small trackpad steps until they make a level: 99 px is not enough, 100 px is", () => {
    let s = { levels: 0, rest: 0 };
    for (let i = 0; i < 33; i++) s = accumulateWheel(s.rest, -3);
    expect(s).toEqual({ levels: 0, rest: -99 });
    s = accumulateWheel(s.rest, -1);
    expect(s).toEqual({ levels: 1, rest: 0 });
  });

  it("drops the leftover when the direction turns", () => {
    expect(accumulateWheel(-90, 20)).toEqual({ levels: 0, rest: 20 });
  });

  it("moves several levels for one large step", () => {
    expect(accumulateWheel(0, -250)).toEqual({ levels: 2, rest: -50 });
  });

  it("reads lines and pages as pixels", () => {
    expect(wheelPixels(3, 1)).toBe(48);
    expect(wheelPixels(1, 2)).toBe(800);
    expect(wheelPixels(-7, 0)).toBe(-7);
  });
});
