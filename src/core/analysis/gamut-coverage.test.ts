import { describe, expect, it } from "vitest";
import { checkColorAnalysis } from "./color-analysis-check";
import type { ColorAnalysis } from "./color-analysis";
import { computeGamutCoverage } from "./gamut-coverage";
import type { ColorCount } from "./types";

const color = (r: number, g: number, b: number, percent = 1): ColorCount => ({ r, g, b, count: 1, percent });

describe("computeGamutCoverage", () => {
  it("counts one occupied cell of the 6,789 for a single colour", () => {
    const g = computeGamutCoverage([color(255, 0, 0, 100)]);
    expect(g.totalCells).toBe(6789);
    expect(g.occupiedCells).toBe(1);
    expect(g.coverage).toBeCloseTo(1 / 6789, 12);
  });

  it("counts colours in the same cell once, and far-apart colours separately", () => {
    // 1 level apart is far below 0.02 ΔE_OK; black and white are far apart.
    expect(computeGamutCoverage([color(128, 128, 128), color(129, 128, 128)]).occupiedCells).toBe(1);
    expect(computeGamutCoverage([color(0, 0, 0), color(255, 255, 255)]).occupiedCells).toBe(2);
  });

  it("passes the contract check and flags a partial colour list as a lower bound", () => {
    const g = computeGamutCoverage([color(0, 0, 0)], 9000);
    expect(g.meta.method).toMatch(/lower bound/);
    expect(computeGamutCoverage([color(0, 0, 0)]).meta.method).not.toMatch(/lower bound/);
    const x: ColorAnalysis = { schemaVersion: 1, status: "computed", inputKind: "unknown", sourceProfile: "srgb", pipeline: [], palette: [], structures: [], findings: [], gamut: g };
    expect(checkColorAnalysis(x)).toEqual([]);
  });
});
