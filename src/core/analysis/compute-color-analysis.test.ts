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
    expect(x.pipeline.find((p) => p.step === "structures")?.status).toBe("not-implemented");
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
