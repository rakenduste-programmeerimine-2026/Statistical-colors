import { colornames } from "color-name-list";
import { describe, expect, it } from "vitest";
import { buildNameIndex, nearestName } from "./names";
import { srgbToOklab, type Rgb8 } from "./oklch";

const index = buildNameIndex(colornames);

function bruteForce(c: Rgb8): string {
  const [l, a, b] = srgbToOklab(c);
  let best = "";
  let bestD = Infinity;
  for (let i = 0; i < colornames.length; i++) {
    const d = (index.lab[i * 3] - l) ** 2 + (index.lab[i * 3 + 1] - a) ** 2 + (index.lab[i * 3 + 2] - b) ** 2;
    if (d < bestD) {
      bestD = d;
      best = index.names[i];
    }
  }
  return best;
}

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("nearestName", () => {
  it("returns the listed name for a listed colour", () => {
    const first = colornames[0];
    const n = parseInt(first.hex.slice(1), 16);
    expect(nearestName(index, { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 })).toBe(first.name);
  });

  it("agrees with a brute-force search on 300 random colours", () => {
    const r = rng(42);
    for (let i = 0; i < 300; i++) {
      const c = { r: Math.floor(r() * 256), g: Math.floor(r() * 256), b: Math.floor(r() * 256) };
      const want = bruteForce(c);
      const got = nearestName(index, c);
      // Ties can pick either name; both must then be equally near.
      if (got !== want) {
        const d = (name: string) => {
          const i = index.names.indexOf(name);
          const [l, a, b] = srgbToOklab(c);
          return Math.hypot(index.lab[i * 3] - l, index.lab[i * 3 + 1] - a, index.lab[i * 3 + 2] - b);
        };
        expect(d(got)).toBeCloseTo(d(want), 6);
      }
    }
  });

  it.each([
    [{ r: 0, g: 0, b: 0 }],
    [{ r: 255, g: 255, b: 255 }],
    [{ r: 128, g: 128, b: 128 }],
    [{ r: 255, g: 0, b: 0 }],
    [{ r: 0, g: 255, b: 0 }],
    [{ r: 0, g: 0, b: 255 }],
    [{ r: 255, g: 255, b: 0 }],
  ])("finds the true nearest name at the gamut edges and on the grey axis: %j", (c) => {
    expect(nearestName(index, c)).toBe(bruteForce(c));
  });

  it("answers repeated colours from its cache", () => {
    const c = { r: 12, g: 34, b: 56 };
    expect(nearestName(index, c)).toBe(nearestName(index, { ...c }));
    expect(index.cache.has((12 << 16) | (34 << 8) | 56)).toBe(true);
  });
});
