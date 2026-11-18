import { describe, expect, it } from "vitest";
import { describeAnalysisServiceContract } from "@/core/analysis/analysis-service.contract";
import type { PixelDecoder } from "@/core/decode-image";
import { memorySupabase, type FailingCall } from "@/test/memory-supabase";
import { SupabaseAnalysisService } from "./supabase-analysis-service";

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d];

/** 3×2 pixels: red twice, a half-transparent green, blue, red, white. */
const PIXELS = [255, 0, 0, 255, 255, 0, 0, 255, 0, 255, 0, 128, 0, 0, 255, 255, 255, 0, 0, 255, 255, 255, 255, 255];

const png = (name = "photo 1.png") => new File([new Uint8Array(PNG_SIGNATURE)], name, { type: "image/png" });

/** Stands in for the browser decoder, which jsdom does not have. */
const fakeDecoder = (decode: PixelDecoder["decode"] = async () => ({ width: 3, height: 2, pixels: Uint8ClampedArray.from(PIXELS) })) => ({
  decode,
});

function service(fail: FailingCall[] = [], decoder = fakeDecoder()) {
  const db = memorySupabase(fail);
  return { db, service: new SupabaseAnalysisService(() => db.client, decoder, () => Promise.resolve()) };
}

describeAnalysisServiceContract("SupabaseAnalysisService", () => service().service, png);

describe("SupabaseAnalysisService", () => {
  const options = { includeAlpha: true, topN: 10 };

  it("stores the counted colours, not simulated ones", async () => {
    const { service: s, db } = service();
    const a = (await s.getAnalysis(await s.analyze(png(), options)))!;
    expect(a).toMatchObject({ width: 3, height: 2, totalPixels: 6, uniqueColors: 4, includeAlpha: true });
    expect(a.colors.map(({ r, g, b, a: alpha, count }) => [r, g, b, alpha, count])).toEqual([
      [255, 0, 0, 255, 3],
      [0, 255, 0, 128, 1],
      [0, 0, 255, 255, 1],
      [255, 255, 255, 255, 1],
    ]);
    expect(a.simulated).toBeUndefined();
    expect(db.files.size).toBe(1);
  });

  it("labels the colour analysis and row data simulated, the same after a reload", async () => {
    const { service: s, db } = service();
    const id = await s.analyze(png(), options);
    const first = (await s.getAnalysis(id))!;
    expect(first.rowDataStatus).toBe("simulated");
    expect(first.colorAnalysis?.status).toBe("simulated");
    const reloaded = new SupabaseAnalysisService(() => db.client, fakeDecoder());
    expect(await reloaded.getAnalysis(id)).toEqual(first);
  });

});
