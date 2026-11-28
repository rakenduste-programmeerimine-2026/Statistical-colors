import { describe, expect, it } from "vitest";
import { contrastFinding, contrastPairs, contrastRatio, passesFor } from "./contrast";
import { clusterColors } from "./palette-clusters";
import type { ColorCount } from "./types";

const grey = (v: number, percent: number): ColorCount => ({ r: v, g: v, b: v, count: percent * 100, percent });
const analyse = (colors: ColorCount[]) => {
  const palette = clusterColors(colors);
  const pairs = contrastPairs(palette);
  return { palette, pairs, finding: contrastFinding(pairs, palette) };
};

describe("contrastRatio and passesFor", () => {
  it("gives 21 for white on black and 1 for a colour on itself", () => {
    expect(contrastRatio({ r: 255, g: 255, b: 255 }, { r: 0, g: 0, b: 0 })).toBe(21);
    expect(contrastRatio({ r: 90, g: 10, b: 200 }, { r: 90, g: 10, b: 200 })).toBe(1);
  });

  it("passes AA text at 4.5 and large text at 3, not just below", () => {
    expect(passesFor(4.5)).toMatchObject({ aaText: true, aaLargeText: true });
    expect(passesFor(4.49)).toMatchObject({ aaText: false, aaLargeText: true });
    expect(passesFor(2.99)).toMatchObject({ aaText: false, aaLargeText: false, aaNonText: false });
  });
});

describe("contrastPairs", () => {
  it("pairs only clusters with at least 1 % share", () => {
    const { pairs } = analyse([grey(0, 60), grey(255, 30), grey(128, 0.9)]);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].ratio).toBe(21);
  });
});

describe("contrastFinding", () => {
  it("is info for two darks and a white, shown with the best pair", () => {
    const { finding, palette } = analyse([grey(20, 50), grey(40, 30), grey(255, 20)]);
    expect(finding?.severity).toBe("info");
    expect(finding?.clusterIds).toEqual([palette.find((p) => p.representativeRgb?.r === 255)!.id, palette.find((p) => p.representativeRgb?.r === 20)!.id]);
    expect(finding?.metrics?.find((m) => m.key === "pairsAa")?.value).toBe(2);
  });

  it("is a notice when no pair reaches 4.5 but one reaches 3, and a warning when none reaches 3", () => {
    expect(analyse([grey(90, 50), grey(180, 50)]).finding?.severity).toBe("notice");
    expect(analyse([grey(120, 50), grey(140, 50)]).finding?.severity).toBe("warning");
  });

  it("is absent without two large clusters", () => {
    expect(analyse([grey(0, 100)]).finding).toBeUndefined();
  });
});
