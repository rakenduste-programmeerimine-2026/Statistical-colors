import { describe, expect, it } from "vitest";
import { oklchToSrgb } from "./oklch";
import { clampChroma } from "./oklch";
import { arcPath, chromaRadius, deltaERadius, lightnessRingWidth, LOW_CHROMA, MAX_CHROMA, medianLightness, polar, ringChroma, ringSegments } from "./wheel";

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

  it("finds the widest constant chroma in sRGB at a lightness (experiment E2: 0.127 at L 0.75)", () => {
    // E2 printed 0.127 to three decimals; the exact edge is 0.1275.
    expect(ringChroma(0.75)).toBeGreaterThanOrEqual(0.127);
    expect(ringChroma(0.75)).toBeLessThan(0.128);
    // At black and white only greys fit (within the gamut test's 1e-4 tolerance).
    expect(ringChroma(0)).toBeLessThan(LOW_CHROMA);
    expect(ringChroma(1)).toBeLessThan(LOW_CHROMA);
  });

  it.each([0.05, 0.3, 0.5, 0.75, 0.9, 0.98])("keeps every hue inside sRGB at L %f", (l) => {
    const c = ringChroma(l);
    for (let h = 0; h < 360; h += 0.5) expect(oklchToSrgb({ l, c: Math.max(0, c - 1e-4), h }).inGamut).toBe(true);
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

describe("medianLightness", () => {
  it.each<[number[], number]>([
    [[0.4], 0.4],
    [[0.9, 0.2, 0.5], 0.5],
    [[0.2, 0.4, 0.6, 0.9], 0.5],
    [[0.3, 0.3], 0.3],
  ])("of %j is %f", (ls, m) => expect(medianLightness(ls)).toBeCloseTo(m, 12));

  it("does not reorder its input", () => {
    const ls = [0.9, 0.1, 0.5];
    medianLightness(ls);
    expect(ls).toEqual([0.9, 0.1, 0.5]);
  });
});

describe("lightnessRingWidth", () => {
  it("is a hairline for the darkest colour, grows with ΔL and stops at 16 px", () => {
    expect(lightnessRingWidth(0)).toBe(1);
    expect(lightnessRingWidth(0.1)).toBeCloseTo(4, 12);
    expect(lightnessRingWidth(0.5)).toBe(16);
    expect(lightnessRingWidth(1)).toBe(16);
    expect(lightnessRingWidth(-0.1)).toBe(1);
  });
});

describe("clampChroma", () => {
  it("leaves in-gamut colours alone and pulls others to the sRGB edge, keeping L and h", () => {
    const inside = { l: 0.6, c: 0.05, h: 120 };
    expect(clampChroma(inside)).toBe(inside);
    const out = clampChroma({ l: 0.6, c: 0.4, h: 120 });
    expect(out.l).toBe(0.6);
    expect(out.h).toBe(120);
    expect(oklchToSrgb(out).inGamut).toBe(true);
    expect(oklchToSrgb({ ...out, c: out.c + 0.001 }).inGamut).toBe(false);
  });
});
