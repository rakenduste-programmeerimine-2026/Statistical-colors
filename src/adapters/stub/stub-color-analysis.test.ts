import { describe, expect, it } from "vitest";
import { deltaEOk, oklchToSrgb } from "@/core/color/oklch";
import { generateAnalysis, hash, prng } from "./stub-analysis-service";
import { generateColorAnalysis } from "./stub-color-analysis";

describe("generateColorAnalysis", () => {
  it("is deterministic for a seed", () => {
    expect(generateColorAnalysis(prng(1))).toEqual(generateColorAnalysis(prng(1)));
    expect(generateColorAnalysis(prng(1))).not.toEqual(generateColorAnalysis(prng(2)));
  });

  it("says it is simulated, and every result carries the consistency caveat", () => {
    const x = generateColorAnalysis(prng(3));
    expect(x.status).toBe("simulated");
    for (const f of x.findings) expect(f.meta.method).toMatch(/^simulated: /);
  });

  it("keeps every colour inside sRGB", () => {
    const x = generateColorAnalysis(prng(4));
    for (const c of x.palette) expect(oklchToSrgb(c.color).inGamut).toBe(true);
  });

  it("reports ΔE per point as the distance between the ideal and the actual colour", () => {
    for (const s of generateColorAnalysis(prng(5)).structures) {
      for (const p of s.points) expect(p.deltaE).toBeCloseTo(deltaEOk(p.ideal, p.actual), 4);
    }
  });

  it("sends several structures, one of them built in HSL", () => {
    const x = generateColorAnalysis(prng(6));
    expect(x.structures.map((s) => s.code)).toEqual(["harmony.triadic", "ramp.iso-lightness-equal-step", "harmony.complementary"]);
    expect(x.structures.find((s) => s.model === "hsl")?.points.some((p) => p.deltaE > 0.01)).toBe(true);
  });
});

describe("generateAnalysis", () => {
  it("attaches a colour analysis without changing the generated colours", () => {
    const file = { name: "a.png", size: 1234 };
    const options = { includeAlpha: false, topN: 10 };
    const result = generateAnalysis("id", file, options);
    expect(result.colorAnalysis).toEqual(generateColorAnalysis(prng(hash("a.png:1234:false:color"))));
    // The colours come from the original seed, as before the colour analysis existed.
    const random = prng(hash("a.png:1234:false"));
    const width = 16 + Math.floor(random() * 81);
    expect(result.width).toBe(width);
  });
});
