import { describe, expect, it } from "vitest";
import { filterColors, isFiltered, NO_FILTER, topArtefact } from "./color-filter";
import { shareBands } from "./share-bands";
import type { ColorCount } from "./types";

const row = (percent: number, chance?: number, clusterId?: string): ColorCount => ({
  r: 0,
  g: 0,
  b: 0,
  count: 1,
  percent,
  ...(chance === undefined ? {} : { artefacts: [{ kind: "artefact.antialias-blend", chance }] }),
  ...(clusterId === undefined ? {} : { clusterId }),
});

const colors = [row(30, 0.1, "c0"), row(25, 0.5, "c1"), row(1, 0.49, "c0"), row(0.02, 0.9, "c1"), row(0.01)];
const bands = shareBands(colors.map((c) => c.percent));

describe("filterColors", () => {
  it("returns every colour without a filter", () => {
    expect(isFiltered(NO_FILTER)).toBe(false);
    expect(filterColors(colors, NO_FILTER, bands)).toBe(colors);
  });

  it("filters by share band", () => {
    expect(filterColors(colors, { ...NO_FILTER, band: bands[0].id }, bands).map((c) => c.percent)).toEqual([30, 25]);
  });

  it("filters by cluster", () => {
    expect(filterColors(colors, { ...NO_FILTER, cluster: "c1" }, bands).map((c) => c.percent)).toEqual([25, 0.02]);
  });

  it("counts a chance of exactly 0.5 as likely and 0.49 as clean; colours without a value are neither", () => {
    expect(filterColors(colors, { ...NO_FILTER, artefact: "likely" }, bands).map((c) => c.percent)).toEqual([25, 0.02]);
    expect(filterColors(colors, { ...NO_FILTER, artefact: "clean" }, bands).map((c) => c.percent)).toEqual([30, 1]);
  });

  it("combines filters with AND, and can match nothing", () => {
    expect(filterColors(colors, { band: bands[0].id, cluster: "c1", artefact: "likely" }, bands).map((c) => c.percent)).toEqual([25]);
    expect(filterColors(colors, { band: bands[0].id, cluster: "c1", artefact: "clean" }, bands)).toEqual([]);
  });
});

describe("topArtefact", () => {
  it("picks the highest chance, or nothing", () => {
    expect(topArtefact({ ...row(1), artefacts: [{ kind: "a", chance: 0.2 }, { kind: "b", chance: 0.7 }] })?.kind).toBe("b");
    expect(topArtefact(row(1))).toBeUndefined();
  });
});
