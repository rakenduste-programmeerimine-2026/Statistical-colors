import { describe, expect, it } from "vitest";
import type { PaletteCluster } from "./color-analysis";
import { fitHarmonies, HARMONY_TEMPLATES } from "./harmonies";

let next = 0;
const cluster = (h: number | null, share: number, c = 0.12, l = 0.65): PaletteCluster => ({
  id: `c${next++}`,
  color: h === null ? { l, c: 0, h: null } : { l, c, h: ((h % 360) + 360) % 360 },
  share,
  pixelCount: share * 100,
  memberCount: 1,
  spreadDeltaE: 0,
  meta: { provenance: "measured", confidence: 1, method: "test", requires: "pixels" },
});
/** A pure template: one equal-share cluster on every spoke, rotated off the whole-degree grid. */
const pure = (offsets: readonly number[], rotation = 30.3) => offsets.map((o) => cluster(rotation + o, 100 / offsets.length));

describe("fitHarmonies", () => {
  it.each(HARMONY_TEMPLATES.map((t) => [t.code, t.offsets] as const))("finds a pure %s with ΔE 0 at every point", (code, offsets) => {
    const s = fitHarmonies(pure(offsets)).find((x) => x.code === code);
    expect(s).toBeDefined();
    expect(s!.coverage).toBe(1);
    expect(s!.points).toHaveLength(offsets.length);
    for (const p of s!.points) expect(p.deltaE).toBeCloseTo(0, 9);
  });

  it("finds a triad 8° off its spokes with a score below 1, and not one 20° off", () => {
    const noisy = fitHarmonies([cluster(38, 34), cluster(142, 33), cluster(270, 33)]).find((s) => s.code === "harmony.triadic");
    expect(noisy).toBeDefined();
    expect(noisy!.score).toBeLessThan(1);
    expect(noisy!.score).toBeGreaterThan(0);
    expect(fitHarmonies([cluster(50, 34), cluster(130, 33), cluster(270, 33)]).map((s) => s.code)).not.toContain("harmony.triadic");
  });

  it("finds no harmony in at least 95 of 100 random 12-hue palettes", () => {
    // Fixed seeds, so the result never changes. The 0.3 coverage threshold of
    // docs/ontology/02 would let most of these through; requiring 0.8 is the #33 fix.
    let found = 0;
    for (let seed = 1; seed <= 100; seed++) {
      let s = seed;
      const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
      if (fitHarmonies(Array.from({ length: 12 }, () => cluster(rnd() * 360, 0.2 + rnd()))).length) found++;
    }
    expect(found).toBeLessThanOrEqual(5);
  });

  it("keeps templates apart: each pure palette is reported only as its own template", () => {
    const codes = (offsets: readonly number[]) => fitHarmonies(pure(offsets)).map((s) => s.code);
    expect(codes([0, 90, 180, 270])).toEqual(["harmony.square"]);
    expect(codes([0, 150, 210])).toEqual(["harmony.split-complementary"]);
    expect(codes([0, 120, 240])).toEqual(["harmony.triadic"]);
    expect(codes([0, 180])).toEqual(["harmony.complementary"]);
    expect(codes([-30, 0, 30])).toEqual(["harmony.analogous"]);
  });

  it("ignores greys: a large grey does not lower a complementary pair's coverage, and greys alone fit nothing", () => {
    const greyBackground = cluster(200, 80, 0.01);
    const s = fitHarmonies([greyBackground, cluster(40, 10), cluster(220, 10)]).find((x) => x.code === "harmony.complementary");
    expect(s?.coverage).toBe(1);
    expect(s?.points.map((p) => p.clusterId)).not.toContain(greyBackground.id);
    expect(fitHarmonies([cluster(null, 50), cluster(10, 30, 0.02), cluster(190, 20, 0.03)])).toEqual([]);
  });
});
