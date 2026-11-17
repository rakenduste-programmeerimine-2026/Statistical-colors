import { describe, expect, it } from "vitest";
import type { D1Result } from "../src/approaches/d1-matte.ts";
import type { FitRegionResult } from "../src/approaches/f1-fit.ts";
import type { S2Result } from "../src/approaches/s2-scene.ts";
import { COMBINATIONS, coverageTargets, norm, summarise, wordDiff } from "../src/core/combos.ts";
import { TEMPLATES } from "../src/core/control-templates.ts";
import type { Pixels } from "../src/core/img.ts";
import { fromDom, fromPdf, fromTrace, textPart } from "../src/core/patches.ts";
import type { PdfPage } from "../src/core/pdf-paths.ts";
import { makeContext } from "../src/core/pipeline.ts";
import { readMeta, type ControlInfo, type SceneMeta, type SceneNode } from "../src/core/scene.ts";
import { HINTS, PRESETS, REGISTRY } from "../src/registry.ts";
import { fakeCodec, fakeHost, queuedCodec } from "./fake-host.ts";

const font = { usedFamily: "Arial", size: 13, weight: 400, italic: false, ascent: 12, descent: 3 };
const control = (over: Partial<ControlInfo> = {}): ControlInfo => ({
  type: "checkbox",
  checked: true,
  disabled: false,
  text: null,
  uaBorder: false,
  color: [0, 0, 0, 1],
  accent: [255, 0, 0, 1],
  font,
  content: [10, 20, 13, 13],
  ...over,
});
const patch = (c: ControlInfo, over: Partial<SceneNode> = {}): SceneNode => ({ id: "n5", kind: "patch", name: c.type, box: [10, 20, 13, 13], control: c, patch: { reason: "input" }, ...over });

describe("patch routes", () => {
  it("draws a checked checkbox from Chrome's template in the accent colour", () => {
    const r = fromDom(patch(control()), new Map());
    expect(r?.detail).toEqual({ template: "checkbox:checked" });
    expect(r?.svg).toContain('fill="rgb(255, 0, 0)"');
    expect(r?.svg).not.toContain("ACCENT");
    expect(r?.svg.startsWith('<g transform="translate(10 20)"><g transform="scale(1 1)">')).toBe(true);
    expect(r?.children[0]).toMatchObject({ id: "n5v", kind: "vector", box: [10, 20, 13, 13] });
  });

  it("uses Chrome's default accent without one, and the unchecked radio template", () => {
    const r = fromDom(patch(control({ type: "radio", checked: false, accent: null })), new Map());
    expect(r?.detail).toEqual({ template: "radio:unchecked" });
    expect(r?.svg).toContain('stroke="rgb(118, 118, 118)"');
  });

  it("refuses disabled controls and controls without a template", () => {
    expect(fromDom(patch(control({ disabled: true })), new Map())).toBeNull();
    expect(fromDom(patch(control({ type: "range" })), new Map())).toBeNull();
  });

  it("rebuilds a default text field with its text, shifted when asked", () => {
    const c = control({ type: "text", uaBorder: true, text: "Hello", content: [12, 22, 100, 18] });
    const node = patch(c, { box: [10, 20, 104, 22] });
    const r = fromDom(node, new Map([["n5", 30]]), 0.25);
    expect(r?.detail).toEqual({ style: "browser default", textShift: 0.25 });
    expect(r?.svg).toContain(`stroke="${TEMPLATES.controls.field?.stroke}"`);
    // Text top = 22 + (18 − 15) / 2 = 23.5; baseline = 23.5 + 12.
    expect(r?.svg).toContain('<text x="12.25" y="35.5"');
    expect(r?.children[1]).toMatchObject({ kind: "text", text: { characters: "Hello", width: 30, substitute: "Arimo" } });
  });

  it("centres a button label", () => {
    const c = control({ type: "button", text: "Go", content: [0, 0, 100, 20] });
    const r = fromDom(patch(c, { box: [0, 0, 100, 20], style: { fills: [{ type: "solid", color: [200, 200, 200, 1] }] } }), new Map([["n5", 20]]));
    expect(r?.svg).toContain('<text x="40"');
    expect(r?.detail.style).toBe("computed style");
  });

  it("takes control art from the PDF, offset by the scroll position", () => {
    const pdf: PdfPage = {
      width: 800,
      height: 2000,
      paths: [{ d: "M10 120L23 120L23 133Z", fill: "rgb(0, 0, 0)", evenodd: false, stroke: null, strokeWidth: 0, opacity: 1, bbox: [10, 120, 23, 133], order: 0, clips: [] }],
      texts: [],
    };
    const r = fromPdf(patch(control()), pdf, [0, 100], new Map());
    expect(r?.svg).toContain('<g transform="translate(-10 -120)">');
    expect(r?.detail).toEqual({ paths: 1 });
    // A control with text needs the text in the PDF too.
    expect(fromPdf(patch(control({ text: "x" })), pdf, [0, 100], new Map())).toBeNull();
  });

  it("traces a control from the k× image", () => {
    const k = 2;
    const w = 800 * k;
    const data = new Uint8ClampedArray(w * 100 * 4).fill(255);
    for (let y = 44; y < 60; y++) for (let x = 24; x < 40; x++) data.set([0, 0, 0, 255], (y * w + x) * 4);
    const r = fromTrace(patch(control()), { width: w, height: 100, data }, 800);
    expect(r?.detail).toMatchObject({ colours: 2, loops: 1 });
  });

  it("writes control text with the open substitute and no pinned width for unknown fonts", () => {
    const t = textPart(patch(control({ text: "a<b", font: { ...font, usedFamily: "Inter", italic: true } })), 1, 20, 10);
    expect(t.svg).toContain("font-family=\"'Inter'\"");
    expect(t.svg).toContain('font-style="italic"');
    expect(t.svg).toContain(">a&lt;b</text>");
  });
});

describe("combination helpers", () => {
  it("compares words with repeats", () => {
    expect(wordDiff(["a", "b", "b"], ["a", "b", "c"])).toEqual({ missing: ["c"], extra: ["b"] });
  });

  it("normalises colour syntax", () => {
    expect(norm("rgba(1, 2, 3, 1)")).toBe(norm("rgb(1 2 3)"));
    expect(norm("oklch(0.5 0 0)")).toBe("oklch(0.5 0 0)");
  });

  it("turns coverage into black-on-white targets", () => {
    const alpha: Pixels = { width: 1, height: 1, data: new Uint8ClampedArray([255, 0, 0, 255]) };
    const { grey, colour } = coverageTargets(alpha);
    expect([...grey.data]).toEqual([170, 170, 170, 255]);
    expect([...colour.data]).toEqual([0, 255, 255, 255]);
  });

  it("summarises a fit against the true text", () => {
    const res: FitRegionResult = {
      width: 1,
      height: 1,
      background: "x",
      ms: 3,
      items: [
        { kind: "text", text: "Hi", family: "Arial", size: 16, weight: 400, x: 0, y: 0, fill: "x", width: 1, ascent: 1, descent: 1, residual: 0, maxDiff: 0, exact: true, inkPixels: 1, svg: "" },
      ],
    };
    expect(summarise(res, "Hi")).toEqual({ text: "Hi", textCorrect: true, font: "400 16px Arial", residual: 0, exact: true, ms: 3 });
    expect(summarise({ ...res, items: [] }, "Hi")).toMatchObject({ textCorrect: false, exact: false, font: null });
  });
});

describe("combinations", () => {
  const byId = (id: string) => COMBINATIONS.find((c) => c.id === id)!;

  it("S1+S2 lists colours and words only one side has", async () => {
    const ctx = makeContext(fakeHost().host, {}, fakeCodec);
    ctx.out.S1 = { mode: "layout-record", palette: ["rgb(1, 2, 3)", "rgb(9, 9, 9)"], nodes: [], textBoxes: [{ x: 0, y: 0, w: 1, h: 1, text: "Hello big world" }] };
    ctx.out.S2 = { palette: ["rgba(1, 2, 3, 1)", "rgb(4, 5, 6)"], texts: [{ text: "Hello world" }] } as unknown as S2Result;
    expect(await byId("S1+S2").run(ctx)).toMatchObject({
      coloursInBoth: 1,
      onlyInBrowserRecord: ["9,9,9,1"],
      onlyInSvg: ["4,5,6,1"],
      wordsMissingFromSvg: ["big"],
      wordsOnlyInSvg: [],
    });
  });

  it("D1+D2 snaps the background plate and compares with the text-on result", async () => {
    const { host, saved } = fakeHost({ readPalette: { colours: ["rgb(0, 0, 0)", "rgb(255, 255, 255)"], soft: [] } });
    const ctx = makeContext(host, {}, fakeCodec);
    ctx.out.D1 = { background: { width: 2, height: 1, data: new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255]) } } as unknown as D1Result;
    ctx.out.D2 = { report: { snappedPct: 5, snappedSubpixelPct: 1, unexplainedPct: 2 } };
    expect(await byId("D1+D2").run(ctx)).toEqual({
      snappedPct: 0,
      snappedSubpixelPct: 0,
      unexplainedPct: 0,
      withText: { snappedPct: 5, snappedSubpixelPct: 1, unexplainedPct: 2 },
    });
    expect(saved.has("snapped-background.png")).toBe(true);
  });

  it("F1+S2 swaps an exactly fitted canvas into the scene and its metadata", async () => {
    const canvas: SceneNode = { id: "n3", kind: "image", name: "canvas", box: [10, 20, 100, 50], source: { tag: "canvas" } };
    const meta: SceneMeta = { version: 1, viewport: [800, 600], dpr: 1, url: "u", shot: "shot.png", fonts: [], assets: {}, unsupported: [], root: { id: "n0", kind: "frame", name: "html", box: [0, 0, 800, 600], children: [canvas] } };
    const svg = '<svg><defs></defs><image data-raster-source="canvas" x="10" y="20" width="100" height="50" href="data:x"/></svg>';
    const fitted: SceneNode = { id: "f0", kind: "frame", name: "canvas (fitted)", box: [10, 20, 100, 50], source: { tag: "canvas", fitted: true } };
    const { host, saved } = fakeHost({ rasteriseSvg: "data:image/png;base64,AAAA" });
    const ctx = makeContext(host, {}, queuedCodec([{ width: 1, height: 1, data: new Uint8ClampedArray(4) }]));
    ctx.out.S2 = { svg, meta, unsupported: [], report: { vsShot: {} } } as unknown as S2Result;
    ctx.out.F1 = { targets: [{ svg: "<g data-fitted-canvas=\"1\"/>", snapped: [10, 20], allExact: true, metaNode: fitted }], fonts: [] };
    const res = await byId("F1+S2").run(ctx);

    expect(res).toMatchObject({ canvasesVectorised: 1, canvasesKeptAsBitmap: 0, rasterImagesLeft: 0 });
    const out = await saved.get("scene+fit.svg")!.text();
    expect(out).toContain('<g data-fitted-canvas="1"/>');
    expect(readMeta(out)?.root.children?.[0].id).toBe("f0");
    expect(meta.root.children?.[0].id).toBe("n3"); // S2's own metadata is not changed
  });
});

describe("registry", () => {
  const ids = REGISTRY.approaches.map((a) => a.id);

  it("has the seven approaches once each, with a hint for each", () => {
    expect([...ids].sort()).toEqual(["D1", "D2", "F1", "K1", "S1", "S2", "S3"]);
    expect(Object.keys(HINTS).sort()).toEqual([...ids].sort());
  });

  it("only offers presets and combinations made of registered approaches", () => {
    for (const [, preset] of PRESETS) for (const id of preset) expect(ids).toContain(id);
    for (const c of REGISTRY.combinations) for (const id of c.needs) expect(ids).toContain(id);
  });

  it("asks for the debugger exactly for K1, S1 and S3", () => {
    expect(REGISTRY.approaches.filter((a) => a.needsDebugger).map((a) => a.id).sort()).toEqual(["K1", "S1", "S3"]);
  });

  it("runs the patch step last", () => {
    expect(REGISTRY.combinations.at(-1)?.id).toBe("S2+patches");
  });
});

describe("the patch step", () => {
  const white = (w: number, h: number): Pixels => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4).fill(255) });
  function sceneWith(n: number) {
    const kids = Array.from({ length: n }, (_, i): SceneNode => ({ ...patch(control()), id: `p${i}` }));
    const meta: SceneMeta = { version: 1, viewport: [800, 600], dpr: 1, url: "u", shot: "shot.png", fonts: [], assets: {}, unsupported: [], root: { id: "n0", kind: "frame", name: "html", box: [0, 0, 800, 600], children: kids } };
    return { svg: "<svg><defs></defs></svg>", meta, unsupported: [], report: { vsShot: {} } } as unknown as S2Result;
  }
  const step = COMBINATIONS.find((c) => c.id === "S2+patches")!;

  it("accepts a control rebuilt from the DOM when it matches the shot", async () => {
    const { host, saved } = fakeHost({ rasteriseSvg: "data:image/png;base64,AAAA" });
    // The shot is white, and so is every rasterised drawing: the first route scored wins.
    const ctx = makeContext(host, {}, queuedCodec([white(800, 600), white(13, 13)]));
    ctx.out.S2 = sceneWith(1);
    const res = await step.run(ctx);
    expect(res).toMatchObject({ patches: 1, routes: { dom: 1 }, available: { pdf: false, traced: false } });
    const meta = readMeta(await saved.get("scene-final.svg")!.text());
    expect(meta?.root.children?.[0]).toMatchObject({ kind: "frame", confidence: "dom", control: { type: "checkbox" } });
  });

  it("crops a bitmap, unscored, for patches past the limit", async () => {
    const { host } = fakeHost({ rasteriseSvg: "data:image/png;base64,AAAA" });
    const ctx = makeContext(host, {}, queuedCodec([white(800, 600), white(13, 13)]));
    ctx.out.S2 = sceneWith(61);
    const res = (await step.run(ctx)) as { routes: Record<string, number>; rows: { tried: unknown }[] };
    expect(res.routes).toEqual({ dom: 60, bitmap: 1 });
    expect(res.rows[60].tried).toBe("not scored: over the patch limit");
  });
});
