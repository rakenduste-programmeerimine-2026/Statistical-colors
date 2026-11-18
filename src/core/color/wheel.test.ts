import { describe, expect, it } from "vitest";
import { oklchToSrgb } from "./oklch";
import { arcPath, chromaRadius, deltaERadius, LOW_CHROMA, MAX_CHROMA, polar, ringSegments, WHEEL_C, WHEEL_L } from "./wheel";

describe("polar", () => {
  it.each([
    [0, 50, 0],
    [90, 100, 50],
    [180, 50, 100],
    [270, 0, 50],
  ])("puts hue %i° at (%i, %i): 0° up, clockwise", (h, x, y) => {
    const p = polar(h, 50, 50, 50);
    expect(p.x).toBeCloseTo(x, 9);
    expect(p.y).toBeCloseTo(y, 9);
  });
});

describe("ring", () => {
  it("splits the circle into equal segments", () => {
    const s = ringSegments(72);
    expect(s).toHaveLength(72);
    expect(s[0]).toEqual({ h0: 0, h1: 5, mid: 2.5 });
    expect(s[71].h1).toBe(360);
  });

  it("draws a small arc without the large-arc flag, and a big one with it", () => {
    expect(arcPath(0, 5, 40, 50, 50, 50)).toMatch(/A50 50 0 0 1/);
    expect(arcPath(0, 200, 40, 50, 50, 50)).toMatch(/A50 50 0 1 1/);
  });

  it("stays inside sRGB at the ring's lightness and chroma for every hue (experiment E2)", () => {
    for (let h = 0; h < 360; h++) expect(oklchToSrgb({ l: WHEEL_L, c: WHEEL_C, h }).inGamut).toBe(true);
  });
});

describe("chromaRadius", () => {
  it("puts low chroma inside the achromatic core and the rest outside it", () => {
    expect(chromaRadius(0, 20, 100)).toBe(0);
    expect(chromaRadius(LOW_CHROMA - 0.001, 20, 100)).toBeLessThan(20);
    expect(chromaRadius(LOW_CHROMA, 20, 100)).toBe(20);
    expect(chromaRadius(MAX_CHROMA, 20, 100)).toBe(100);
    expect(chromaRadius(1, 20, 100)).toBe(100);
  });
});

describe("deltaERadius", () => {
  it("grows with ΔE from the base size and stops at the maximum", () => {
    expect(deltaERadius(0)).toBe(7);
    expect(deltaERadius(0.02)).toBeCloseTo(13, 9);
    expect(deltaERadius(0.05)).toBeCloseTo(22, 9);
    expect(deltaERadius(1)).toBe(28);
    expect(deltaERadius(-1)).toBe(7);
  });
});
