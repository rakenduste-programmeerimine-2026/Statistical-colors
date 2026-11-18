import { describe, expect, it } from "vitest";
import { checkColorRows } from "@/core/analysis/color-analysis-check";
import type { ColorCount } from "@/core/analysis/types";
import { deltaEOk, srgbToOklch } from "@/core/color/oklch";
import { generateColorAnalysis } from "./color-analysis";
import { simulateColorRows } from "./color-rows";
import { prng } from "./random";

const rows = (): ColorCount[] => [
  { r: 255, g: 255, b: 255, count: 900, percent: 90 },
  { r: 10, g: 20, b: 30, count: 90, percent: 9 },
  { r: 200, g: 40, b: 40, count: 9, percent: 0.9 },
  { r: 120, g: 130, b: 140, count: 1, percent: 0.1 },
];

describe("simulateColorRows", () => {
  it("keeps colours and counts, and adds chances and clusters that pass the check", () => {
    const analysis = generateColorAnalysis(prng(1));
    const out = simulateColorRows(rows(), analysis, prng(2));
    expect(out.map(({ r, g, b, count, percent }) => ({ r, g, b, count, percent }))).toEqual(rows());
    expect(checkColorRows(out, analysis)).toEqual([]);
  });

  it("gives the rarest colours the highest blend chance on average", () => {
    const out = simulateColorRows(rows(), undefined, prng(3));
    const blend = (c: ColorCount) => c.artefacts!.find((a) => a.kind === "artefact.antialias-blend")!.chance;
    expect(blend(out[3])).toBeGreaterThan(blend(out[0]));
  });

  it("assigns each colour to its nearest palette cluster by ΔE", () => {
    const analysis = generateColorAnalysis(prng(4));
    for (const c of simulateColorRows(rows(), analysis, prng(5))) {
      const o = srgbToOklch(c);
      const mine = analysis.palette.find((p) => p.id === c.clusterId)!;
      for (const p of analysis.palette) expect(deltaEOk(o, mine.color)).toBeLessThanOrEqual(deltaEOk(o, p.color));
    }
  });

  it("sends no cluster ids without a colour analysis, and handles no colours", () => {
    expect(simulateColorRows(rows(), undefined, prng(6)).every((c) => c.clusterId === undefined)).toBe(true);
    expect(simulateColorRows([], undefined, prng(6))).toEqual([]);
  });
});

describe("checkColorRows", () => {
  it.each<[string, ColorCount, RegExp]>([
    ["chance over 1", { r: 0, g: 0, b: 0, count: 1, percent: 1, artefacts: [{ kind: "artefact.banding", chance: 1.01 }] }, /chance 1.01 is outside 0–1/],
    ["negative chance", { r: 0, g: 0, b: 0, count: 1, percent: 1, artefacts: [{ kind: "artefact.banding", chance: -0.01 }] }, /chance -0.01/],
    ["empty kind", { r: 0, g: 0, b: 0, count: 1, percent: 1, artefacts: [{ kind: "", chance: 0.5 }] }, /kind is empty/],
    ["unknown cluster", { r: 0, g: 0, b: 0, count: 1, percent: 1, clusterId: "nope" }, /unknown cluster nope/],
  ])("reports %s", (_, row, message) => {
    expect(checkColorRows([row], generateColorAnalysis(prng(1))).join("\n")).toMatch(message);
  });

  it("accepts chances 0 and 1, and rows without the new fields", () => {
    const ok: ColorCount[] = [
      { r: 0, g: 0, b: 0, count: 1, percent: 1, artefacts: [{ kind: "artefact.banding", chance: 0 }] },
      { r: 0, g: 0, b: 0, count: 1, percent: 1, artefacts: [{ kind: "artefact.banding", chance: 1 }] },
      { r: 0, g: 0, b: 0, count: 1, percent: 1 },
    ];
    expect(checkColorRows(ok)).toEqual([]);
  });
});
