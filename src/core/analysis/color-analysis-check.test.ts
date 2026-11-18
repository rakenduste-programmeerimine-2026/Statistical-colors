import { describe, expect, it } from "vitest";
import { generateColorAnalysis } from "@/adapters/simulated/color-analysis";
import { prng } from "@/adapters/simulated/random";
import { simulateGamut } from "@/adapters/simulated/gamut";
import { checkColorAnalysis } from "./color-analysis-check";
import type { ColorAnalysis } from "./color-analysis";
import { findingLabel, FINDING_LABELS, structureLabel, STRUCTURE_LABELS } from "./ontology";

const valid = () => generateColorAnalysis(prng(7));
const gamut = () => simulateGamut([{ r: 9, g: 9, b: 9, count: 1, percent: 100 }]);

describe("checkColorAnalysis", () => {
  it("accepts a consistent analysis, with and without gamut coverage", () => {
    expect(checkColorAnalysis(valid())).toEqual([]);
    expect(checkColorAnalysis({ ...valid(), gamut: gamut() })).toEqual([]);
  });

  it.each<[string, (x: ColorAnalysis) => void, RegExp]>([
    ["schema version", (x) => void ((x as { schemaVersion: number }).schemaVersion = 2), /schemaVersion: 2 is not 1/],
    ["lightness above 1", (x) => void (x.palette[0].color.l = 1.01), /palette\[0\]: l 1.01 is outside 0–1/],
    ["hue of 360", (x) => void (x.palette[2].color.h = 360), /palette\[2\]: h 360 is outside/],
    ["negative chroma", (x) => void (x.palette[2].color.c = -0.01), /c -0.01 is negative/],
    // The stub totals about 92 %; 70 for the background pushes it past 100.
    ["shares over 100", (x) => void (x.palette[0].share = 70), /shares add up to .*, over 100/],
    ["duplicate cluster ids", (x) => void (x.palette[1].id = x.palette[0].id), /cluster ids are not unique/],
    ["negative ΔE", (x) => void (x.structures[0].points[0].deltaE = -0.001), /deltaE -0.001 is negative/],
    ["unknown cluster in a structure", (x) => void (x.structures[0].points[0].clusterId = "nope"), /unknown cluster nope/],
    ["spoke past the template", (x) => void (x.structures[0].points[0].spoke = 3), /spoke 3 is not a template offset/],
    ["coverage over 1", (x) => void (x.structures[0].coverage = 1.2), /coverage 1.2 is outside 0–1/],
    ["unknown nesting", (x) => void (x.structures[0].nestedIn = ["s9"]), /nestedIn unknown structure s9/],
    ["contrast ratio under 1", (x) => void (x.contrast![0].ratio = 0.9), /ratio 0.9 is outside 1–21/],
    ["confidence over 1", (x) => void (x.findings[0].meta.confidence = 1.5), /confidence 1.5 is outside 0–1/],
    ["finding without a title", (x) => void (x.findings[0].title = ""), /has no title/],
    ["gamut coverage over 1", (x) => void (x.gamut = { ...gamut(), coverage: 1.5 }), /gamut: coverage 1.5 is outside 0–1/],
    ["gamut cells that do not add up", (x) => void (x.gamut = { ...gamut(), occupiedCells: 9000 }), /occupiedCells 9000 of totalCells 6789 is impossible/],
    ["gamut coverage that is not the cell share", (x) => void (x.gamut = { ...gamut(), coverage: 0.5 }), /coverage is not occupiedCells \/ totalCells/],
  ])("reports %s", (_, spoil, message) => {
    const x = valid();
    spoil(x);
    expect(checkColorAnalysis(x).join("\n")).toMatch(message);
  });

  it("accepts the boundaries: l 0 and 1, h 0, ΔE 0, coverage 0 and 1, ratio 1 and 21", () => {
    const x = valid();
    x.palette[0].color.l = 0;
    x.palette[1].color = { l: 1, c: 0, h: null };
    x.palette[2].color.h = 0;
    x.structures[0].points[0].deltaE = 0;
    x.structures[0].coverage = 0;
    x.structures[1].coverage = 1;
    x.contrast![0].ratio = 21;
    expect(checkColorAnalysis(x)).toEqual([]);
    x.contrast![0].ratio = 1;
    expect(checkColorAnalysis(x)).toEqual([]);
  });
});

describe("ontology labels", () => {
  it("label the codes and kinds the stub sends", () => {
    const x = valid();
    for (const s of x.structures) expect(STRUCTURE_LABELS[s.code]).toBeDefined();
    for (const f of x.findings) expect(FINDING_LABELS[f.kind]).toBeDefined();
  });

  it("fall back to the server's title for unknown codes and kinds", () => {
    expect(structureLabel({ code: "ramp.future-law", title: "Tuleviku seadus" })).toBe("Tuleviku seadus");
    expect(findingLabel({ kind: "other.new", title: "Uus leid" })).toBe("Uus leid");
    expect(findingLabel({ kind: "ui.dark-mode", title: "x" })).toBe("Tume režiim");
  });
});
