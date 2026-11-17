import { describe, expect, it } from "vitest";
import { describeAnalysisServiceContract } from "@/core/analysis/analysis-service.contract";
import { StubAnalysisService, generateAnalysis } from "./stub-analysis-service";
import { pixelsCsv, summaryCsv } from "./stub-csv";

const image = () => new File([new Uint8Array(1234)], "palette 1.png", { type: "image/png" });

function memoryStorage() {
  const data = new Map<string, string>();
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
}

describeAnalysisServiceContract("StubAnalysisService", () => new StubAnalysisService(memoryStorage()), image);

describe("StubAnalysisService", () => {
  it("marks its results as simulated", async () => {
    const service = new StubAnalysisService();
    const id = await service.analyze(image(), { includeAlpha: false, topN: 3 });
    expect((await service.getAnalysis(id))!.simulated).toBe(true);
  });

  it("builds ids like the original: safe file stem, two underscores, 16 hex digits", async () => {
    const id = await new StubAnalysisService().analyze(image(), { includeAlpha: false, topN: 3 });
    expect(id).toMatch(/^palette_1__[0-9a-f]{16}$/);
  });

  it("finds a result again through storage after a reload", async () => {
    const storage = memoryStorage();
    const id = await new StubAnalysisService(storage).analyze(image(), { includeAlpha: true, topN: 3 });
    const reloaded = new StubAnalysisService(storage);
    expect((await reloaded.getAnalysis(id))!.id).toBe(id);
  });

  it("gives the same fake result for the same file", () => {
    const options = { includeAlpha: false, topN: 5 };
    expect(generateAnalysis("x", image(), options)).toEqual(generateAnalysis("x", image(), options));
  });
});

describe("stub CSV builders", () => {
  const analysis = {
    id: "t__0",
    fileName: "t.png",
    width: 2,
    height: 2,
    totalPixels: 4,
    uniqueColors: 2,
    includeAlpha: true,
    topN: 2,
    colors: [
      { r: 255, g: 0, b: 16, a: 255, count: 3, percent: 75 },
      { r: 0, g: 0, b: 0, a: 0, count: 1, percent: 25 },
    ],
  };

  it("writes the summary in the original format", () => {
    expect(summaryCsv(analysis)).toBe(
      "r,g,b,a,count,percent,hex_rgba\r\n" +
        "255,0,16,255,3,75.0000000000,#FF0010 255\r\n" +
        "0,0,0,0,1,25.0000000000,#000000 000\r\n",
    );
  });

  it("writes one row per pixel, row by row", () => {
    expect(pixelsCsv(analysis)).toBe(
      "x,y,r,g,b,a\r\n0,0,255,0,16,255\r\n1,0,255,0,16,255\r\n0,1,255,0,16,255\r\n1,1,0,0,0,0\r\n",
    );
  });

  it("leaves alpha out in RGB mode", () => {
    const rgb = { ...analysis, includeAlpha: false, colors: [{ r: 1, g: 2, b: 3, count: 4, percent: 100 }] };
    expect(summaryCsv(rgb)).toBe("r,g,b,count,percent,hex_rgb\r\n1,2,3,4,100.0000000000,#010203\r\n");
  });
});
