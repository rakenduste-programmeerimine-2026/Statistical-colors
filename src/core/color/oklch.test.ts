import { describe, expect, it } from "vitest";
import { deltaEOk, formatOklch, hexToOklch, oklchToSrgb, srgbToOklch, type Oklch } from "./oklch";

/** Parses the text form back, as a browser reads `oklch(...)`. */
function parse(text: string): Oklch {
  const m = text.match(/^oklch\(([\d.]+)% ([\d.]+) ([\d.]+|none)(?: \/ ([\d.]+))?\)$/);
  if (!m) throw new Error(`not an oklch() string: ${text}`);
  return { l: Number(m[1]) / 100, c: Number(m[2]), h: m[3] === "none" ? null : Number(m[3]), alpha: m[4] ? Number(m[4]) : undefined };
}

describe("srgbToOklch and formatOklch", () => {
  // Reference values from experiment E1 (CSS Color 4 matrices).
  it.each([
    ["#FF0000", "oklch(62.80% 0.25768 29.23)"],
    ["#032F29", "oklch(27.48% 0.04715 181.31)"],
    ["#0A141E", "oklch(18.70% 0.02534 249.32)"],
    ["#FFFFFF", "oklch(100.00% 0 none)"],
    ["#808080", "oklch(59.99% 0 none)"],
    ["#000000", "oklch(0.00% 0 none)"],
  ])("formats %s as %s", (hex, text) => {
    expect(formatOklch(hexToOklch(hex))).toBe(text);
  });

  it("gives greys no hue, but a near-grey keeps its small chroma and hue", () => {
    expect(srgbToOklch({ r: 128, g: 128, b: 128 }).h).toBeNull();
    const near = srgbToOklch({ r: 128, g: 128, b: 129 });
    expect(near.h).not.toBeNull();
    expect(near.c).toBeGreaterThan(0.000005);
  });

  it("keeps hues inside [0, 360)", () => {
    // A pinkish red sits just below 360°.
    const h = srgbToOklch({ r: 255, g: 0, b: 64 }).h ?? -1;
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThan(360);
  });

  it.each([
    [255, ""],
    [128, " / 0.502"],
    [0, " / 0"],
  ])("shows alpha %i as %j", (a, suffix) => {
    expect(formatOklch(srgbToOklch({ r: 255, g: 0, b: 0, a }))).toBe(`oklch(62.80% 0.25768 29.23${suffix})`);
  });
});

describe("round trip through the text form", () => {
  const back = (r: number, g: number, b: number) => oklchToSrgb(parse(formatOklch(srgbToOklch({ r, g, b }))));

  it("returns every grey exactly", () => {
    for (let v = 0; v < 256; v++) expect(back(v, v, v)).toMatchObject({ r: v, g: v, b: v });
  });

  it("returns a grid of colours exactly (the full 16.7M check is experiment E1)", () => {
    let wrong = 0;
    for (let r = 0; r < 256; r += 15) for (let g = 0; g < 256; g += 15) for (let b = 0; b < 256; b += 15) {
      const x = back(r, g, b);
      if (x.r !== r || x.g !== g || x.b !== b) wrong++;
    }
    expect(wrong).toBe(0);
  });

  it("flags colours outside sRGB", () => {
    expect(oklchToSrgb({ l: 0.7, c: 0.4, h: 150 }).inGamut).toBe(false);
    expect(oklchToSrgb({ l: 0.7, c: 0.1, h: 150 }).inGamut).toBe(true);
  });
});

describe("deltaEOk", () => {
  it("is 0 for the same colour and grows with distance", () => {
    const red = hexToOklch("#FF0000");
    expect(deltaEOk(red, red)).toBe(0);
    expect(deltaEOk(hexToOklch("#000000"), hexToOklch("#FFFFFF"))).toBeCloseTo(1, 6);
  });
});
