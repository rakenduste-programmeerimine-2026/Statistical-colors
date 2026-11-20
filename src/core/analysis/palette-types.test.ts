import { describe, expect, it } from "vitest";
import type { PaletteCluster } from "./color-analysis";
import { paletteTypes } from "./palette-types";

let next = 0;
const cluster = (l: number, c: number, h: number | null, share: number): PaletteCluster => ({
  id: `c${next++}`,
  color: { l, c, h },
  share,
  pixelCount: share * 100,
  memberCount: 1,
  spreadDeltaE: 0,
  meta: { provenance: "measured", confidence: 1, method: "test", requires: "pixels" },
});
const codes = (p: PaletteCluster[]) => paletteTypes(p).map((s) => s.code);

describe("paletteTypes", () => {
  it("calls greys only achromatic, with ΔE as each grey's distance from pure grey", () => {
    const s = paletteTypes([cluster(0.98, 0, null, 60), cluster(0.2, 0.01, 250, 40)]);
    expect(s.map((x) => x.code)).toEqual(["palette.achromatic"]);
    expect(s[0].points.map((p) => p.deltaE)).toEqual([0, expect.closeTo(0.01, 9)]);
  });

  it("calls greys with one accent hue neutral plus accent, also with two shades of that hue", () => {
    expect(codes([cluster(0.98, 0, null, 70), cluster(0.2, 0, null, 20), cluster(0.6, 0.15, 25, 10)])).toEqual(["palette.neutral-plus-accent"]);
    expect(codes([cluster(0.98, 0, null, 70), cluster(0.6, 0.15, 25, 8), cluster(0.5, 0.14, 33, 2)])).toEqual(["palette.neutral-plus-accent"]);
  });

  it("finds neither in a colourful triad, nor in greys with two accents 90° apart", () => {
    expect(codes([cluster(0.6, 0.15, 30, 34), cluster(0.7, 0.12, 150, 33), cluster(0.5, 0.1, 270, 33)])).toEqual([]);
    expect(codes([cluster(0.98, 0, null, 70), cluster(0.6, 0.15, 25, 15), cluster(0.6, 0.15, 115, 15)])).toEqual([]);
  });
});
