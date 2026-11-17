import { afterEach, describe, expect, it, vi } from "vitest";
import type * as F1Module from "../src/approaches/f1-fit.ts";
import { candidateFonts, F1, fittedNode, MAX_TARGETS, shownOneToOne, type FitRegionResult } from "../src/approaches/f1-fit.ts";
import type { RasterTarget } from "../src/core/page-fns.ts";
import { makeContext } from "../src/core/pipeline.ts";
import { compiled, fromSource } from "./compiled.ts";
import { fakeCodec, fakeHost } from "./fake-host.ts";

const target = (over: Partial<RasterTarget> = {}): RasterTarget => ({ tag: "canvas", x: 10, y: 20, w: 100, h: 50, backing: [100, 50], ...over });
const env = { os: "win", browser: "chrome", browserVersion: null, arch: null, osSource: "detected", browserSource: "detected" } as const;

describe("candidateFonts", () => {
  it("tries the page's fonts, then the OS's, then generic families, once each", () => {
    expect(candidateFonts(env, ["Inter", "Arial"]).slice(0, 4)).toEqual(["Inter", "Arial", "Segoe UI", "Tahoma"]);
    expect(candidateFonts(null)).toEqual(["sans-serif", "serif", "monospace", "system-ui"]);
  });
});

describe("shownOneToOne", () => {
  it.each([
    [[100, 50], 1, true],
    [[100.9, 50], 1, true],
    [[101, 50], 1, false],
    [[200, 100], 2, true],
    [[100, 50], 2, false],
  ] as const)("backing %j at DPR %d: %s", (backing, dpr, expected) => {
    expect(shownOneToOne(target({ backing: [...backing] }), dpr)).toBe(expected);
  });

  it("is false when the backing size is unknown", () => {
    expect(shownOneToOne(target({ backing: null }), 1)).toBe(false);
  });
});

const fit: FitRegionResult = {
  width: 100,
  height: 50,
  background: "rgb(255, 255, 255)",
  ms: 5,
  items: [
    { kind: "rect", x: 2, y: 4, w: 20, h: 10, r: 2, fill: "rgb(255, 0, 0)", analyticFirstGuess: {}, residual: 0, maxDiff: 0, exact: true, svg: "<rect/>" },
    {
      kind: "text",
      text: "Hi",
      family: "Arial",
      size: 16,
      weight: 400,
      x: 30,
      y: 40,
      fill: "rgb(0, 0, 0)",
      width: 14,
      ascent: 12,
      descent: 4,
      residual: 3,
      maxDiff: 2,
      exact: false,
      inkPixels: 100,
      svg: "<text/>",
    },
  ],
};

describe("fittedNode", () => {
  it("turns fitted items into scene nodes in page CSS px", () => {
    const node = fittedNode(0, target(), fit, 10, 20, 2);
    expect(node).toMatchObject({ id: "f0", kind: "frame", source: { tag: "canvas", fitted: true }, style: { fills: [{ type: "solid", color: [255, 255, 255, 1] }], clip: true } });
    expect(node.children?.[0]).toMatchObject({ kind: "frame", confidence: "fitted-exact", box: [11, 22, 10, 5], style: { radii: [1, 1, 1, 1] } });
    expect(node.children?.[1]).toMatchObject({
      kind: "text",
      confidence: "fitted",
      box: [25, 34, 7, 8],
      text: { characters: "Hi", usedFamily: "Arial", substitute: "Arimo", size: 8, baseline: 40 },
    });
  });
});

describe("F1.run", () => {
  it("fits 1:1 canvases, skips scaled ones and writes fit.json and fit.svg", async () => {
    const targets = [target(), target({ backing: [300, 150] })];
    const { host, saved } = fakeHost({ listRasterTargets: targets, fontFamilies: ["Inter"], fitRegion: fit });
    const res = await F1.run(makeContext(host, { env }, fakeCodec));

    expect(res.targets[0]).toMatchObject({ allExact: false, snapped: [10, 20] });
    expect(res.targets[1].skipped).toBe("canvas is scaled on screen; pixels are resampled");
    expect(host.page).toHaveBeenCalledWith(expect.objectContaining({ name: "fitRegion" }), expect.stringMatching(/^data:image\/png;base64,/), {
      maxMs: 45000,
      fonts: expect.arrayContaining(["Inter", "Segoe UI"]),
    });
    expect(res.report).toMatchObject({ rasterTargets: 2, skipped: 1, items: 2, exactItems: 1 });
    expect(await saved.get("fit.svg")!.text()).toContain('<g data-fitted-canvas="1" transform="translate(10 20) scale(1)">');
    const json = JSON.parse(await saved.get("fit.json")!.text());
    expect(json.targets[0].svg).toBeUndefined();
    expect(json.targets[0].metaNode).toBeUndefined();
  });

  it(`fits at most ${MAX_TARGETS} canvases`, async () => {
    const targets = Array.from({ length: MAX_TARGETS + 1 }, () => target());
    const { host } = fakeHost({ listRasterTargets: targets, fontFamilies: [], fitRegion: { ...fit, items: [] } });
    const res = await F1.run(makeContext(host, {}, fakeCodec));
    expect(res.targets.filter((t) => t.skipped)).toHaveLength(1);
    expect(res.targets[MAX_TARGETS].skipped).toBe(`only the first ${MAX_TARGETS} canvases are fitted`);
  });

  it("saves no fit.svg when nothing was fitted", async () => {
    const { host, saved } = fakeHost({ listRasterTargets: [], fontFamilies: [] });
    await F1.run(makeContext(host, {}, fakeCodec));
    expect(saved.has("fit.json")).toBe(true);
    expect(saved.has("fit.svg")).toBe(false);
  });
});

describe("fitRegion in a page", () => {
  afterEach(() => vi.restoreAllMocks());

  it("runs from its source text alone and finds nothing on a blank region", async () => {
    const { fitRegion } = compiled<typeof F1Module>("../src/approaches/f1-fit.ts");
    // jsdom has no canvas: a 4 × 2 all-white image and a context that only reads it back.
    HTMLImageElement.prototype.decode = async () => {}; // jsdom has none
    vi.spyOn(HTMLImageElement.prototype, "width", "get").mockReturnValue(4);
    vi.spyOn(HTMLImageElement.prototype, "height", "get").mockReturnValue(2);
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage: () => {},
      fillRect: () => {},
      getImageData: (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4).fill(255) }),
    } as unknown as CanvasRenderingContext2D);
    const res = await fromSource(fitRegion)("data:image/png;base64,AAAA", { maxMs: 1000 });
    expect(res).toMatchObject({ width: 4, height: 2, background: "rgb(255, 255, 255)", items: [] });
  });
});
