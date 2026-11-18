import { describe, expect, it } from "vitest";
import { InvalidImageError, type AnalysisService } from "./analysis-service";
import { checkColorAnalysis } from "./color-analysis-check";

/**
 * Behaviour every AnalysisService adapter must have. The stub runs it now;
 * the real backend adapter (#40) must pass it too.
 */
export function describeAnalysisServiceContract(
  name: string,
  make: () => AnalysisService,
  /** A file the adapter can analyse. Real adapters need a real image. */
  sampleImage: () => File,
) {
  describe(`${name} (AnalysisService contract)`, () => {
    it("stores an analysis and returns it by id", async () => {
      const service = make();
      const file = sampleImage();
      const id = await service.analyze(file, { includeAlpha: false, topN: 10 });

      const analysis = await service.getAnalysis(id);
      expect(analysis).not.toBeNull();
      expect(analysis!.id).toBe(id);
      expect(analysis!.fileName).toBe(file.name);
      expect(analysis!.includeAlpha).toBe(false);
      expect(analysis!.topN).toBe(10);
    });

    it("sends a colour analysis that passes the check, when it sends one", async () => {
      const service = make();
      const analysis = await service.getAnalysis(await service.analyze(sampleImage(), { includeAlpha: false, topN: 10 }));
      if (analysis?.colorAnalysis) expect(checkColorAnalysis(analysis.colorAnalysis)).toEqual([]);
    });

    it("returns consistent totals, sorted colours and percentages", async () => {
      const service = make();
      const id = await service.analyze(sampleImage(), { includeAlpha: false, topN: 5000 });
      const a = (await service.getAnalysis(id))!;

      expect(a.totalPixels).toBe(a.width * a.height);
      expect(a.uniqueColors).toBeGreaterThanOrEqual(1);
      expect(a.uniqueColors).toBeLessThanOrEqual(a.totalPixels);
      expect(a.colors.length).toBeGreaterThanOrEqual(Math.min(a.topN, a.uniqueColors));
      for (let i = 1; i < a.colors.length; i++) {
        expect(a.colors[i - 1].count).toBeGreaterThanOrEqual(a.colors[i].count);
      }
      for (const c of a.colors) {
        expect(c.percent).toBeCloseTo((c.count / a.totalPixels) * 100, 8);
        for (const v of [c.r, c.g, c.b]) expect(v).toSatisfy((n: number) => Number.isInteger(n) && n >= 0 && n <= 255);
        expect(c.a).toBeUndefined();
      }
      if (a.colors.length === a.uniqueColors) {
        expect(a.colors.reduce((s, c) => s + c.count, 0)).toBe(a.totalPixels);
      }
    });

    it("includes alpha 0–255 on every colour when asked", async () => {
      const service = make();
      const id = await service.analyze(sampleImage(), { includeAlpha: true, topN: 5000 });
      const a = (await service.getAnalysis(id))!;
      expect(a.includeAlpha).toBe(true);
      for (const c of a.colors) expect(c.a).toSatisfy((n: number) => Number.isInteger(n) && n >= 0 && n <= 255);
    });

    it("rejects an empty file as an invalid image", async () => {
      await expect(make().analyze(new File([], "empty.png"), { includeAlpha: false, topN: 1 })).rejects.toBeInstanceOf(
        InvalidImageError,
      );
    });

    it("returns null for an unknown id", async () => {
      const service = make();
      expect(await service.getAnalysis("missing__0000000000000000")).toBeNull();
      expect(await service.getCsv("missing__0000000000000000", "summary")).toBeNull();
    });

    it("provides both CSV downloads named after the analysis", async () => {
      const service = make();
      const id = await service.analyze(sampleImage(), { includeAlpha: false, topN: 1 });

      const summary = (await service.getCsv(id, "summary"))!;
      expect(summary.fileName).toBe(`${id}_color_summary.csv`);
      expect((await summary.content.text()).split("\r\n")[0]).toBe("r,g,b,count,percent,hex_rgb");

      const pixels = (await service.getCsv(id, "pixels"))!;
      expect(pixels.fileName).toBe(`${id}_pixels.csv`);
      expect((await pixels.content.text()).split("\r\n")[0]).toBe("x,y,r,g,b");
    });
  });
}
