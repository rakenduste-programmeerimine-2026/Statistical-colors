import { afterEach, describe, expect, it, vi } from "vitest";
import { F1, MAX_TARGETS, TOTAL_MS } from "../src/approaches/f1-fit.ts";
import { effectiveScale, MAX_PIXELS } from "../src/approaches/k1-hires.ts";
import type * as S2Module from "../src/approaches/s2-scene.ts";
import type { S2Result } from "../src/approaches/s2-scene.ts";
import type * as CombosModule from "../src/core/combos.ts";
import { COMBINATIONS } from "../src/core/combos.ts";
import type { Pixels } from "../src/core/img.ts";
import type * as PatchesModule from "../src/core/patches.ts";
import { MAX_SCORED_PATCHES, PATCH_MS } from "../src/core/patches.ts";
import { MAX_PDF_BYTES, MAX_PDF_PATHS, parsePdfPage } from "../src/core/pdf-paths.ts";
import { makeContext } from "../src/core/pipeline.ts";
import type { SceneMeta, SceneNode } from "../src/core/scene.ts";
import { MAX_TRACE_PIXELS, traceRegion } from "../src/core/trace.ts";
import { compiled, fromSource } from "./compiled.ts";
import { fakeCodec, fakeHost, queuedCodec } from "./fake-host.ts";

afterEach(() => vi.restoreAllMocks());

describe("K1 pixel limit", () => {
  it.each([
    ["exactly the limit", 8000, 2000, true],
    ["one row over", 8000, 2001, false],
  ])("%s keeps or halves the scale", (_, vw, vh, keeps) => {
    // At DPR 1 and k = 2: 8000 × 2000 × 4 = 64 MP.
    expect(vw * vh * 4 <= MAX_PIXELS).toBe(keeps);
    expect(effectiveScale(vw, vh, 1, 2)).toBe(keeps ? 2 : 1);
  });
});

describe("trace size limit", () => {
  const img = (w: number, h: number): Pixels => {
    const data = new Uint8ClampedArray(w * h * 4).fill(255);
    data.set([0, 0, 0, 255], 0);
    return { width: w, height: h, data };
  };
  it.each([
    ["exactly 1.5 MP is traced", 1500, 1000, false],
    ["one row over is refused", 1500, 1001, true],
  ])("%s", (_, w, h, refused) => {
    expect(w * h > MAX_TRACE_PIXELS).toBe(refused);
    expect(traceRegion(img(w, h), 0, 0, w, h, 1) === null).toBe(refused);
  });
});

describe("PDF limits", () => {
  it("refuses a file over the byte limit before reading it", async () => {
    const big = { length: MAX_PDF_BYTES + 1 } as Uint8Array;
    await expect(parsePdfPage(big)).rejects.toThrow("-byte limit");
  });

  /** A page whose content draws `n` one-point squares. */
  const page = (n: number) => {
    const content = Array.from({ length: n }, () => "0 0 1 1 re f").join(" ");
    return new TextEncoder().encode(
      "%PDF-1.4\n1 0 obj\n<< /Type /Page /MediaBox [0 0 72 72] /Contents 2 0 R >>\nendobj\n" +
        `2 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`,
    );
  };

  it(`keeps at most ${MAX_PDF_PATHS} paths and says it stopped`, async () => {
    const at = await parsePdfPage(page(MAX_PDF_PATHS));
    expect(at.paths).toHaveLength(MAX_PDF_PATHS);
    expect(at.truncated).toBeUndefined();
    const over = await parsePdfPage(page(MAX_PDF_PATHS + 1));
    expect(over.paths).toHaveLength(MAX_PDF_PATHS);
    expect(over.truncated).toBe("path limit");
    // Two pages of 100,000 paths take about 3–6 s when the whole suite runs at once (it timed out at the 5 s default).
  }, 20_000);

  it("stops at the time budget", async () => {
    let t = 0;
    // The clock is read every 4096 tokens; each read here moves it 60 ms.
    const res = await parsePdfPage(page(10_000), { maxMs: 100, now: () => (t += 60) });
    expect(res.truncated).toBe("time budget");
    expect(res.paths.length).toBeLessThan(10_000);
  });
});

describe("patch limits", () => {
  const white = (w: number, h: number): Pixels => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4).fill(255) });
  const control = {
    type: "checkbox",
    checked: true,
    disabled: false,
    text: null,
    uaBorder: false,
    color: null,
    accent: null,
    font: { usedFamily: "Arial", size: 13, weight: 400, italic: false, ascent: 12, descent: 3 },
    content: [0, 0, 13, 13],
  };
  function run(n: number) {
    const kids = Array.from({ length: n }, (_, i) => ({ id: `p${i}`, kind: "patch", name: "x", box: [10, 20, 13, 13], control, patch: { reason: "input" } }) as SceneNode);
    const meta = { version: 1, viewport: [800, 600], dpr: 1, url: "u", shot: "s", fonts: [], assets: {}, unsupported: [], root: { id: "r", kind: "frame", name: "html", box: [0, 0, 800, 600], children: kids } } as SceneMeta;
    const ctx = makeContext(fakeHost({ rasteriseSvg: "data:image/png;base64,AAAA" }).host, {}, queuedCodec([white(800, 600), white(13, 13)]));
    ctx.out.S2 = { svg: "<svg><defs></defs></svg>", meta, unsupported: [], report: { vsShot: {} } } as unknown as S2Result;
    const step = COMBINATIONS.find((c) => c.id === "S2+patches");
    return step!.run(ctx) as Promise<{ routes: Record<string, number>; rows: { tried: unknown }[] }>;
  }

  it(`scores exactly ${MAX_SCORED_PATCHES} patches`, async () => {
    expect((await run(MAX_SCORED_PATCHES)).routes).toEqual({ dom: MAX_SCORED_PATCHES });
  });

  it("sends the rest to bitmaps once the time budget is spent", async () => {
    let t = 0;
    vi.spyOn(performance, "now").mockImplementation(() => (t += PATCH_MS / 2 + 1));
    const res = await run(3);
    expect(res.routes.bitmap).toBeGreaterThan(0);
    expect(res.rows.at(-1)?.tried).toBe("not scored: time budget");
  });
});

describe("F1 limits", () => {
  const target = { tag: "canvas", x: 0, y: 0, w: 10, h: 10, backing: [10, 10] };
  const fit = { width: 10, height: 10, background: "rgb(255, 255, 255)", items: [], ms: 1 };

  it(`fits exactly ${MAX_TARGETS} canvases without skipping`, async () => {
    const { host } = fakeHost({ listRasterTargets: Array(MAX_TARGETS).fill(target), fontFamilies: [], fitRegion: fit });
    const res = await F1.run(makeContext(host, {}, fakeCodec));
    expect(res.targets.filter((t) => t.skipped)).toHaveLength(0);
  });

  it("skips the remaining canvases once the whole-run budget is spent", async () => {
    let t = 0;
    vi.spyOn(performance, "now").mockImplementation(() => (t += TOTAL_MS / 2 + 1));
    const { host } = fakeHost({ listRasterTargets: [target, target, target], fontFamilies: [], fitRegion: fit });
    const res = await F1.run(makeContext(host, {}, fakeCodec));
    expect(res.targets.map((x) => x.skipped ?? "fitted")).toContain("time budget for the whole run");
  });
});

describe("the remaining page functions run from their source text", () => {
  it("measureRuns", () => {
    const { measureRuns } = compiled<typeof PatchesModule>("../src/core/patches.ts");
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ font: "", measureText: (s: string) => ({ width: s.length * 7 }) } as unknown as CanvasRenderingContext2D);
    expect(fromSource(measureRuns)([["13px Arial", "abc"]])).toEqual([21]);
  });

  it("opaqueCanvasGivesSubpixelText", () => {
    const { opaqueCanvasGivesSubpixelText } = compiled<typeof CombosModule>("../src/core/combos.ts");
    const grey = { fillRect: () => {}, fillText: () => {}, getImageData: () => ({ data: new Uint8ClampedArray([100, 100, 100, 255]) }) };
    const spy = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(grey as unknown as CanvasRenderingContext2D);
    expect(fromSource(opaqueCanvasGivesSubpixelText)()).toBe(false);
    spy.mockReturnValue({ ...grey, getImageData: () => ({ data: new Uint8ClampedArray([200, 100, 20, 255]) }) } as unknown as CanvasRenderingContext2D);
    expect(fromSource(opaqueCanvasGivesSubpixelText)()).toBe(true);
  });

  it("rasteriseSvg", async () => {
    const { rasteriseSvg } = compiled<typeof S2Module>("../src/approaches/s2-scene.ts");
    HTMLImageElement.prototype.decode = async () => {}; // jsdom has none
    vi.spyOn(HTMLImageElement.prototype, "width", "get").mockReturnValue(10);
    vi.spyOn(HTMLImageElement.prototype, "height", "get").mockReturnValue(5);
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage: () => {} } as unknown as CanvasRenderingContext2D);
    const toDataURL = vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockImplementation(function (this: HTMLCanvasElement) {
      return `data:${this.width}x${this.height}`;
    });
    await expect(fromSource(rasteriseSvg)("<svg/>", 2)).resolves.toBe("data:20x10");
    expect(toDataURL).toHaveBeenCalledWith("image/png");
  });
});
