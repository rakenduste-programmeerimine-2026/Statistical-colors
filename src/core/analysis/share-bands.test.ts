import { describe, expect, it } from "vitest";
import { bandOf, formatShare, shareBands } from "./share-bands";

describe("shareBands", () => {
  it("returns nothing for no colours, and one band for one colour", () => {
    expect(shareBands([])).toEqual([]);
    expect(shareBands([100])).toEqual([{ id: "d-10", min: 100, max: 100, count: 1, label: "100 %" }]);
  });

  it("splits at gaps in the log share, largest shares first", () => {
    const bands = shareBands([0.02, 30, 0.03, 25, 1.2, 1, 0.025]);
    expect(bands.map((b) => [b.label, b.count])).toEqual([
      ["25–30 %", 2],
      ["1.0–1.2 %", 2],
      ["0.020–0.030 %", 3],
    ]);
  });

  it("splits at a gap of exactly half a decade, but not just under it", () => {
    // Both values sit in the 1–10 % decade, so without a gap they share one band.
    const half = 9 / Math.sqrt(10);
    expect(shareBands([9, half])).toHaveLength(2);
    expect(shareBands([9, half * 1.001])).toHaveLength(1);
  });

  it("falls back to decade bands when the shares have no gap", () => {
    // Each step is a third of a decade: no gap of half a decade.
    const shares = [20, 10, 4.6, 2.2, 1, 0.46, 0.22, 0.1, 0.046, 0.022, 0.01, 0.0046];
    expect(shareBands(shares).map((b) => [b.id, b.count])).toEqual([
      ["d-10", 2],
      ["d-1", 3],
      ["d-0.1", 3],
      ["d-0.01", 3],
      ["d-small", 1],
    ]);
  });

  it("puts equal shares in one band", () => {
    expect(shareBands([5, 5, 5])).toEqual([{ id: "d-1", min: 5, max: 5, count: 3, label: "5.0 %" }]);
  });

  it("keeps at most 6 bands, cutting at the widest gaps", () => {
    const shares = [100, 10, 1, 0.1, 0.01, 0.001, 0.0001, 0.00001];
    const bands = shareBands(shares);
    expect(bands).toHaveLength(6);
    expect(bands.reduce((n, b) => n + b.count, 0)).toBe(shares.length);
  });

  it("assigns every share to exactly one band", () => {
    const shares = [30, 25, 1.2, 1, 0.03, 0.02];
    const bands = shareBands(shares);
    for (const p of shares) expect(bands.filter((b) => p >= b.min && p <= b.max)).toHaveLength(1);
    expect(bandOf(bands, 1)?.label).toBe("1.0–1.2 %");
    expect(bandOf(bands, 5)).toBeUndefined();
  });
});

describe("formatShare", () => {
  it.each([
    [0, "0"],
    [0.0123, "0.012"],
    [0.5, "0.50"],
    [1, "1.0"],
    [9.99, "10.0"],
    [10, "10"],
    [100, "100"],
  ])("prints %f as %s", (p, text) => expect(formatShare(p)).toBe(text));
});
