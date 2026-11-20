import { describe, expect, it } from "vitest";
import { blendFinding, withBlendChances } from "./blends";
import type { ColorCount } from "./types";

const c = (r: number, g: number, b: number, percent: number): ColorCount => ({ r, g, b, count: percent * 100, percent });
const chance = (rows: ColorCount[], i: number) => rows[i].artefacts?.[0].chance;
const RED = c(255, 0, 0, 50);
const WHITE = c(255, 255, 255, 40);

describe("withBlendChances", () => {
  it("calls the midpoint of red and white at 0.5 % a blend", () => {
    const rows = withBlendChances([RED, WHITE, c(255, 128, 128, 0.5)]);
    expect(chance(rows, 2)).toBeGreaterThanOrEqual(0.5);
    expect(rows[2].artefacts?.[0].kind).toBe("artefact.antialias-blend");
    expect(blendFinding(rows)?.meta.caveats).toContain("consistent-not-proven");
  });

  it("gives 0 to a rare colour on no segment and to a frequent colour on one", () => {
    expect(chance(withBlendChances([RED, WHITE, c(0, 0, 255, 0.5)]), 2)).toBe(0);
    expect(chance(withBlendChances([RED, WHITE, c(255, 128, 128, 5)]), 2)).toBe(0);
  });

  it("gives 0 to a rare colour one value from a frequent one: it is not between the ends", () => {
    // #C96432 at 0.3 % next to #C86432 at 50 % projects at t ≈ 0 on the segment to white.
    expect(chance(withBlendChances([c(200, 100, 50, 50), WHITE, c(201, 100, 50, 0.3)]), 2)).toBe(0);
  });
});
