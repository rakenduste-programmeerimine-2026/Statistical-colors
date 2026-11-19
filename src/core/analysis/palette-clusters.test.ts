import { describe, expect, it } from "vitest";
import { srgbToOklab, type Vec3 } from "../color/oklch";
import { assignClusterIds, clusterColors, filterShares } from "./palette-clusters";
import type { ColorCount } from "./types";

const c = (r: number, g: number, b: number, count = 10, percent = 10): ColorCount => ({ r, g, b, count, percent });
const d = (p: Vec3, q: Vec3) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);

describe("filterShares", () => {
  it("drops colours under 0.05 % and keeps those at it", () => {
    const { kept, removedShare } = filterShares([c(0, 0, 0, 1, 0.05), c(9, 9, 9, 1, 0.04)]);
    expect(kept.map((x) => x.r)).toEqual([0]);
    expect(removedShare).toBeCloseTo(0.04, 10);
  });

  it("drops a colour far below the others on the log share (z < −2)", () => {
    const common = Array.from({ length: 49 }, (_, i) => c(i, 0, 0, 100, 2));
    const { kept } = filterShares([...common, c(0, 0, 255, 3, 0.06)]);
    expect(kept).toHaveLength(49);
  });
});

describe("clusterColors", () => {
  it("merges colours closer than τ and keeps far ones apart", () => {
    const p = clusterColors([c(200, 0, 0, 30, 30), c(201, 0, 0, 10, 10), c(0, 0, 200, 20, 20)]);
    expect(p.map((x) => [x.id, x.memberCount, x.share, x.pixelCount])).toEqual([
      ["c0", 2, 40, 40],
      ["c1", 1, 20, 20],
    ]);
    expect(p[0].spreadDeltaE).toBeLessThanOrEqual(0.02);
    expect(p[0].representativeRgb).toEqual({ r: 200, g: 0, b: 0 });
  });

  it("does not chain: A–B and B–C within τ but A–C beyond it stay in two clusters", () => {
    const [A, B, C] = [c(100, 100, 100), c(104, 104, 104), c(108, 108, 108)];
    const [a, b, cc] = [A, B, C].map((x) => srgbToOklab(x));
    const tau = Math.max(d(a, b), d(b, cc)) * 1.01;
    expect(d(a, cc)).toBeGreaterThan(tau);
    expect(clusterColors([A, B, C], tau)).toHaveLength(2);
  });
});

describe("assignClusterIds", () => {
  it("gives a colour its cluster within τ and none beyond it", () => {
    const palette = clusterColors([c(200, 0, 0)]);
    const [near, far] = assignClusterIds([c(201, 0, 0), c(0, 200, 0)], palette);
    expect(near.clusterId).toBe("c0");
    expect(far).not.toHaveProperty("clusterId");
  });
});
