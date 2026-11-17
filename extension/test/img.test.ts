import { describe, expect, it, vi } from "vitest";
import { blobToDataUrl, crop, dataUrlToBlob, diff, parseColor, rectMask, rgbInt, type Pixels } from "../src/core/img.ts";

/** A w × h image whose pixel (x, y) is [x, y, x + y, 255]. */
function ramp(w: number, h: number): Pixels {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data.set([x, y, x + y, 255], (y * w + x) * 4);
  return { width: w, height: h, data };
}
const solid = (w: number, h: number, rgb: [number, number, number]): Pixels => {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) data.set([...rgb, 255], i * 4);
  return { width: w, height: h, data };
};
const at = (img: Pixels, x: number, y: number) => [...img.data.subarray((y * img.width + x) * 4, (y * img.width + x) * 4 + 4)];

describe("data URLs", () => {
  it("round-trips bytes and type", async () => {
    const bytes = new Uint8Array([0, 1, 127, 128, 255]);
    const url = await blobToDataUrl(new Blob([bytes], { type: "image/png" }));
    expect(url).toBe("data:image/png;base64,AAF/gP8=");
    const back = dataUrlToBlob(url);
    expect(back.type).toBe("image/png");
    expect(new Uint8Array(await back.arrayBuffer())).toEqual(bytes);
  });

  it("handles more bytes than one chunk", async () => {
    const bytes = new Uint8Array(0x8000 * 2 + 3).map((_, i) => i % 256);
    const back = dataUrlToBlob(await blobToDataUrl(new Blob([bytes])));
    expect(new Uint8Array(await back.arrayBuffer())).toEqual(bytes);
    expect(back.type).toBe("application/octet-stream");
  });
});

describe("crop", () => {
  it("copies the rectangle", () => {
    const out = crop(ramp(10, 10), 2, 3, 4, 2);
    expect([out.width, out.height]).toEqual([4, 2]);
    expect(at(out, 0, 0)).toEqual([2, 3, 5, 255]);
    expect(at(out, 3, 1)).toEqual([5, 4, 9, 255]);
  });

  it("clips to the image", () => {
    expect(crop(ramp(10, 10), 8, 8, 5, 5)).toMatchObject({ width: 2, height: 2 });
    expect(crop(ramp(10, 10), -3, -3, 2, 2)).toMatchObject({ width: 2, height: 2 });
  });

  it("keeps the last column when the origin is on it", () => {
    const out = crop(ramp(10, 10), 9, 9, 3, 3);
    expect([out.width, out.height]).toEqual([1, 1]);
    expect(at(out, 0, 0)).toEqual([9, 9, 18, 255]);
  });

  it.each([
    ["origin one past the right edge", 10, 0, 2, 2],
    ["origin far past the bottom", 0, 11, 2, 2],
    ["zero size", 2, 2, 0, 0],
  ])("gives a transparent 1 × 1 for %s", (_, x, y, w, h) => {
    expect(crop(ramp(10, 10), x, y, w, h)).toEqual({ width: 1, height: 1, data: new Uint8ClampedArray(4) });
  });
});

describe("diff", () => {
  it("reports a size mismatch", () => {
    expect(diff(ramp(2, 2), ramp(3, 2))).toMatchObject({ sizeMismatch: [2, 2, 3, 2], compared: 0, maxDiff: 255 });
  });

  it("counts identical images as 100 % exact", () => {
    expect(diff(ramp(4, 4), ramp(4, 4))).toMatchObject({ exactPct: 100, tolPct: 100, maxDiff: 0, compared: 16 });
  });

  it.each([
    [8, 100],
    [9, 0],
  ])("treats a difference of %i at tolerance 8 as within: %i %", (d, tolPct) => {
    const r = diff(solid(2, 2, [100, 100, 100]), solid(2, 2, [100 + d, 100, 100]), { tol: 8 });
    expect(r).toMatchObject({ exactPct: 0, tolPct, maxDiff: d });
  });

  it("skips masked pixels", () => {
    const b = ramp(2, 1);
    b.data[0] = 200;
    const r = diff(ramp(2, 1), b, { mask: new Uint8Array([1, 0]) });
    expect(r).toMatchObject({ compared: 1, exactPct: 100, maxDiff: 0 });
  });

  it("compares brightness only in luma mode", () => {
    // Same sum of channels, different colour: an LCD text fringe.
    const r = diff(solid(1, 1, [90, 100, 110]), solid(1, 1, [110, 100, 90]), { luma: true });
    expect(r.maxDiff).toBe(0);
    expect(diff(solid(1, 1, [90, 100, 110]), solid(1, 1, [110, 100, 90])).maxDiff).toBe(20);
  });

  it("draws differences red and masked pixels blue in the heat image", () => {
    const r = diff(solid(3, 1, [0, 0, 0]), { ...solid(3, 1, [0, 0, 0]), data: new Uint8ClampedArray([0, 0, 0, 255, 50, 0, 0, 255, 0, 0, 0, 255]) }, { heat: true, mask: new Uint8Array([0, 0, 1]) });
    expect(at(r.heat!, 0, 0)).toEqual([190, 190, 190, 255]);
    expect(at(r.heat!, 1, 0)).toEqual([255, 0, 0, 255]);
    expect(at(r.heat!, 2, 0)).toEqual([120, 140, 255, 255]);
  });
});

describe("rectMask", () => {
  const ones = (m: Uint8Array, w: number) =>
    [...m].flatMap((v, i) => (v ? [[i % w, Math.floor(i / w)]] : []));

  it("marks the rectangle at the given scale", () => {
    expect(ones(rectMask(4, 4, [{ x: 0.5, y: 0.5, w: 0.5, h: 0.5 }], 2), 4)).toEqual([[1, 1]]);
  });

  it("grows by pad and clips at the edges", () => {
    expect(ones(rectMask(3, 3, [{ x: 0, y: 0, w: 1, h: 1 }], 1, 1), 3)).toEqual([
      [0, 0], [1, 0], [0, 1], [1, 1],
    ]);
  });
});

describe("colours", () => {
  it("packs rgb into one integer", () => {
    expect(rgbInt(0x12, 0x34, 0x56)).toBe(0x123456);
  });

  it.each([
    ["rgb(1, 2, 3)", [1, 2, 3, 1]],
    ["rgba(1, 2, 3, 0.5)", [1, 2, 3, 0.5]],
    ["rgb(1 2 3 / 0.25)", [1, 2, 3, 0.25]],
    ["rgb(1.6, 2.4, 3)", [2, 2, 3, 1]],
    ["#80FF0000", [255, 0, 0, 128 / 255]],
  ])("reads %s", (css, expected) => {
    expect(parseColor(css)).toEqual(expected);
  });

  it("returns null for empty input and for formats it cannot read without a fallback", () => {
    expect(parseColor("")).toBeNull();
    expect(parseColor(null)).toBeNull();
    expect(parseColor("oklch(0.5 0.1 200)")).toBeNull();
    expect(parseColor("#ff0000")).toBeNull();
  });

  it("asks the fallback for other formats, such as oklch from computed styles", () => {
    const fallback = vi.fn().mockReturnValue([10, 20, 30, 1]);
    expect(parseColor("oklch(0.5 0.1 200)", fallback)).toEqual([10, 20, 30, 1]);
    expect(fallback).toHaveBeenCalledWith("oklch(0.5 0.1 200)");
    parseColor("rgb(1, 2, 3)", fallback);
    expect(fallback).toHaveBeenCalledTimes(1);
  });
});
