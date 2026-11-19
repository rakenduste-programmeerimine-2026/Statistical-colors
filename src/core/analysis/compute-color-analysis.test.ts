import { describe, expect, it } from "vitest";
import { checkColorAnalysis } from "./color-analysis-check";
import { computeColorAnalysis, inputKindFor } from "./compute-color-analysis";
import type { ColorCount } from "./types";

const colors: ColorCount[] = [
  { r: 0, g: 0, b: 0, count: 3, percent: 75 },
  { r: 255, g: 255, b: 255, count: 1, percent: 25 },
];

describe("computeColorAnalysis", () => {
  it("is computed, passes the contract check and holds nothing simulated", () => {
    const x = computeColorAnalysis(colors, 2, "png");
    expect(checkColorAnalysis(x)).toEqual([]);
    expect(x.status).toBe("computed");
    expect(x.gamut?.occupiedCells).toBe(2);
    expect(JSON.stringify(x)).not.toMatch(/simulated/);
    expect(x.structures.map((s) => s.code)).toEqual(["palette.achromatic"]);
    expect(x.palette.map((p) => [p.share, p.representativeRgb])).toEqual([
      [75, { r: 0, g: 0, b: 0 }],
      [25, { r: 255, g: 255, b: 255 }],
    ]);
    expect(x.contrast?.map((p) => p.ratio)).toEqual([21]);
    // Black 75 % with white 25 % is also a flat dark background with light content.
    expect(x.findings.map((f) => [f.kind, f.severity])).toEqual([
      ["accessibility.contrast", "info"],
      ["ui.dark-mode", "info"],
    ]);
  });

  it("finds the triad of pure red, green and blue and passes the contract check", () => {
    // In OKLCH #FF0000, #00FF00 and #0000FF sit at about 29°, 142° and 264°,
    // not exactly 120° apart, so this checks real colours within the 15° tolerance.
    const rgb = [
      { r: 255, g: 0, b: 0, count: 34, percent: 34 },
      { r: 0, g: 255, b: 0, count: 33, percent: 33 },
      { r: 0, g: 0, b: 255, count: 33, percent: 33 },
    ];
    const x = computeColorAnalysis(rgb, 3);
    expect(x.structures.map((s) => s.code)).toContain("harmony.triadic");
    expect(x.pipeline.find((p) => p.step === "structures")?.status).toBe("done");
    expect(checkColorAnalysis(x)).toEqual([]);
  });

  it("sets a blend colour aside before clustering and reports it", () => {
    const x = computeColorAnalysis([...colors.map((c) => ({ ...c, percent: c.percent - 0.25 })), { r: 128, g: 128, b: 128, count: 1, percent: 0.5 }], 3);
    expect(x.palette).toHaveLength(2);
    expect(x.pipeline.find((p) => p.step === "blend-snap")).toMatchObject({ status: "done", removedShare: 0.5 });
    expect(x.findings.map((f) => f.kind)).toContain("artefact.antialias-blend");
    expect(checkColorAnalysis(x)).toEqual([]);
  });

  it("skips clustering when every colour is too rare", () => {
    const x = computeColorAnalysis([{ r: 1, g: 2, b: 3, count: 1, percent: 0.01 }], 1);
    expect(x.palette).toEqual([]);
    expect(x.pipeline.find((p) => p.step === "cluster")?.status).toBe("skipped");
    expect(checkColorAnalysis(x)).toEqual([]);
  });

  it("maps the stored format to the input kind", () => {
    expect(["png", "gif", "bmp", "jpeg", "webp", undefined].map((f) => inputKindFor(f as never))).toEqual([
      "png-lossless",
      "png-lossless",
      "png-lossless",
      "jpeg-lossy",
      "unknown",
      "unknown",
    ]);
  });
});
