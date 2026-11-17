import { describe, expect, it, vi } from "vitest";
import { describeAnalysisServiceContract } from "@/core/analysis/analysis-service.contract";
import { StubAnalysisService } from "../stub/stub-analysis-service";
import { DEMO_ID, withDemo } from "./with-demo";
import { memoryStorage } from "@/test/render";

const sample = () => new File([new Uint8Array(64).fill(7)], "sample.png", { type: "image/png" });

// Wrapping must not change how real ids behave.
describeAnalysisServiceContract(
  "withDemo(StubAnalysisService)",
  () => withDemo(new StubAnalysisService(memoryStorage())),
  sample,
);

describe("withDemo", () => {
  it("serves the colour picker study result for the demo id", async () => {
    const demo = await withDemo(new StubAnalysisService(memoryStorage())).getAnalysis(DEMO_ID);
    expect(demo).toMatchObject({
      fileName: "palette (1).bmp",
      width: 512,
      height: 40,
      totalPixels: 20480,
      uniqueColors: 295,
      example: true,
      imageUrl: "/demo/palette.bmp",
    });
    expect(demo?.simulated).toBeUndefined();
    expect(demo?.colors).toHaveLength(295);
    expect(demo?.colors[0]).toEqual({
      r: 255,
      g: 255,
      b: 255,
      count: 1664,
      percent: 8.125,
    });
    expect(demo?.colors.reduce((sum, c) => sum + c.count, 0)).toBe(20480);
  });

  it("returns a copy, so callers cannot change the example", async () => {
    const service = withDemo(new StubAnalysisService(memoryStorage()));
    const first = await service.getAnalysis(DEMO_ID);
    first!.colors.length = 0;
    expect((await service.getAnalysis(DEMO_ID))?.colors).toHaveLength(295);
  });

  it.each([
    ["pixels", "/demo/palette_pixels.csv", "demo_pixels.csv"],
    ["summary", "/demo/palette_summary.csv", "demo_color_summary.csv"],
  ] as const)("downloads the original %s CSV", async (kind, url, fileName) => {
    const fetchFile = vi.fn().mockResolvedValue(new Response("x,y\r\n"));
    const csv = await withDemo(new StubAnalysisService(memoryStorage()), fetchFile).getCsv(DEMO_ID, kind);
    expect(fetchFile).toHaveBeenCalledWith(url);
    expect(csv?.fileName).toBe(fileName);
    expect(await csv?.content.text()).toBe("x,y\r\n");
  });

  it.each([
    ["a missing file", () => Promise.resolve(new Response("", { status: 404 }))],
    ["a network error", () => Promise.reject(new TypeError("offline"))],
  ])("returns null for %s", async (_, fetchFile) => {
    const service = withDemo(new StubAnalysisService(memoryStorage()), fetchFile as typeof fetch);
    expect(await service.getCsv(DEMO_ID, "summary")).toBeNull();
  });
});
