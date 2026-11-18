import { describe, expect, it } from "vitest";
import { AnalysisFailedError, InvalidImageError } from "@/core/analysis/analysis-service";
import { describeAnalysisServiceContract } from "@/core/analysis/analysis-service.contract";
import { ExactDecodingUnsupportedError, type PixelDecoder } from "@/core/decode-image";
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

  it("builds the pixel CSV from the latest analysis", async () => {
    const { service: s } = service();
    const id = await s.analyze(png(), options);
    const csv = (await s.getCsv(id, "pixels"))!;
    expect(csv.fileName).toBe(`${id}_pixels.csv`);
    expect(await csv.content.text()).toBe(
      "x,y,r,g,b,a\r\n0,0,255,0,0,255\r\n1,0,255,0,0,255\r\n2,0,0,255,0,128\r\n" +
        "0,1,0,0,255,255\r\n1,1,255,0,0,255\r\n2,1,255,255,255,255\r\n",
    );
  });

  it("has no pixel CSV for an earlier analysis or after a reload (PLACEHOLDER #38)", async () => {
    const { service: s, db } = service();
    const first = await s.analyze(png(), options);
    const second = await s.analyze(png(), options);
    expect(await s.getCsv(first, "pixels")).toBeNull();
    expect(await s.getCsv(second, "pixels")).not.toBeNull();
    expect(await new SupabaseAnalysisService(() => db.client).getCsv(second, "pixels")).toBeNull();
  });

  it("drops the previous pixels even when the next analysis fails", async () => {
    const fail: FailingCall[] = [];
    const { service: s } = service(fail);
    const id = await s.analyze(png(), options);
    fail.push("images:insert");
    await expect(s.analyze(png(), options)).rejects.toBeInstanceOf(AnalysisFailedError);
    expect(await s.getCsv(id, "pixels")).toBeNull();
  });

  it.each([
    ["an unsupported format", new File(["GIF7"], "x.gif"), fakeDecoder()],
    ["a file the browser cannot decode", png(), fakeDecoder(() => Promise.reject(new DOMException("bad", "InvalidStateError")))],
  ])("rejects %s as an invalid image", async (_label, file, decoder) => {
    await expect(service([], decoder).service.analyze(file, options)).rejects.toBeInstanceOf(InvalidImageError);
  });

  it.each<[string, FailingCall[], PixelDecoder]>([
    ["exact decoding is not supported", [], fakeDecoder(() => Promise.reject(new ExactDecodingUnsupportedError()))],
    ["anonymous sign-in fails", ["auth:signIn"], fakeDecoder()],
    ["saving the image fails", ["images:insert"], fakeDecoder()],
    ["uploading the summary CSV fails", ["storage:upload"], fakeDecoder()],
  ])("reports a failed analysis when %s", async (_label, fail, decoder) => {
    await expect(service(fail, decoder).service.analyze(png(), options)).rejects.toBeInstanceOf(AnalysisFailedError);
  });
});
