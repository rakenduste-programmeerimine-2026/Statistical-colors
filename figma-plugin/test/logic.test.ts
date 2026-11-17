import { describe, expect, it } from "vitest";
import { SUBSTITUTES as EXTENSION_SUBSTITUTES } from "../../extension/src/approaches/s2-scene.ts";
import {
  buildFontIndex,
  compareBrightness,
  countNodes,
  effectsOf,
  fillsOf,
  geometry,
  gradientTransform,
  pickStyle,
  readSceneMeta,
  reportLines,
  resolveFont,
  strokePlan,
  SUBSTITUTES,
} from "../src/logic.ts";
import { sampleMeta } from "./scene.ts";

describe("fonts", () => {
  it("uses the same substitutes as the extension", () => {
    expect(SUBSTITUTES).toEqual(EXTENSION_SUBSTITUTES);
  });

  it.each([
    [["Regular", "Bold"], 700, false, { style: "Bold", exact: true }],
    [["Regular", "Bold"], 600, false, { style: "Bold", exact: false }],
    [["Regular", "Semi Bold", "Bold"], 600, false, { style: "Semi Bold", exact: true }],
    [["Regular", "Italic"], 400, true, { style: "Italic", exact: true }],
    [["Regular", "Bold Oblique"], 700, true, { style: "Bold Oblique", exact: true }],
    [["Regular", "Bold"], 700, true, { style: "Bold", exact: false }],
    [["Condensed"], 400, false, { style: "Condensed", exact: false }],
    // Halfway between two weights: the lighter one wins the tie.
    [["Regular", "Medium"], 450, false, { style: "Regular", exact: false }],
  ])("picks %j for weight %d italic %s", (styles, weight, italic, expected) => {
    expect(pickStyle(styles, weight, italic)).toEqual(expected);
  });

  const index = buildFontIndex([
    { fontName: { family: "Arial", style: "Regular" } },
    { fontName: { family: "Arimo", style: "Regular" } },
    { fontName: { family: "Inter", style: "Regular" } },
  ]);
  const run = (usedFamily: string) => ({ usedFamily, substitute: null, weight: 400, italic: false });

  it("prefers the browser's font, then its open substitute, then a last resort", () => {
    expect(resolveFont(run("Arial"), false, index)).toMatchObject({ fontName: { family: "Arial" }, how: "exact" });
    expect(resolveFont(run("Arial"), true, index)).toMatchObject({ fontName: { family: "Arimo" }, how: "substitute" });
    expect(resolveFont(run("Helvetica"), false, index)).toMatchObject({ fontName: { family: "Arimo" }, how: "substitute" });
    expect(resolveFont(run("Nonexistent Sans"), false, index)).toMatchObject({ fontName: { family: "Inter" }, how: "fallback" });
  });

  it("returns null when not even a last resort is installed", () => {
    expect(resolveFont(run("Arial"), false, buildFontIndex([]))).toBeNull();
  });
});

describe("gradientTransform", () => {
  // Inverting Figma's matrix must map the CSS gradient's start to (0, 0.5) and its end to (1, 0.5).
  it.each([
    [90, 120, 26],
    [180, 50, 80],
    [45, 100, 40],
    [300, 77, 13],
  ])("maps the start and end of a %d° gradient on %d × %d", (angle, w, h) => {
    const M = gradientTransform(angle, w, h);
    const a = (angle * Math.PI) / 180;
    const dx = Math.sin(a);
    const dy = -Math.cos(a);
    const len = Math.abs(w * dx) + Math.abs(h * dy);
    const apply = (x: number, y: number) => [M[0][0] * x + M[0][1] * y + M[0][2], M[1][0] * x + M[1][1] * y + M[1][2]];
    const start = apply(0.5 - (dx * len) / 2 / w, 0.5 - (dy * len) / 2 / h);
    const end = apply(0.5 + (dx * len) / 2 / w, 0.5 + (dy * len) / 2 / h);
    expect(start[0]).toBeCloseTo(0, 9);
    expect(start[1]).toBeCloseTo(0.5, 9);
    expect(end[0]).toBeCloseTo(1, 9);
    expect(end[1]).toBeCloseTo(0.5, 9);
  });
});

describe("paints", () => {
  it("makes solid and linear fills, clamping stop positions", () => {
    const fills = fillsOf(
      {
        fills: [
          { type: "solid", color: [255, 0, 0, 0.5] },
          { type: "linear", angle: 90, stops: [{ pos: -0.1, color: [0, 0, 0, 1] }, { pos: 1.2, color: null }] },
          { type: "solid", color: null },
        ],
      },
      10,
      10,
    );
    expect(fills[0]).toEqual({ type: "SOLID", color: { r: 1, g: 0, b: 0 }, opacity: 0.5 });
    expect(fills[1]).toMatchObject({ type: "GRADIENT_LINEAR", gradientStops: [{ position: 0 }, { position: 1, color: { a: 0 } }] });
    expect(fills).toHaveLength(2);
  });

  it("makes shadows, with spread only when there is one", () => {
    const fx = effectsOf({
      effects: [
        { type: "drop-shadow", x: 0, y: 4, blur: 14, spread: 0, color: [0, 0, 0, 0.25] },
        { type: "inner-shadow", x: 1, y: 1, blur: 2, spread: 3, color: [0, 0, 0, 1] },
      ],
    });
    expect(fx[0]).toEqual({ type: "DROP_SHADOW", color: { r: 0, g: 0, b: 0, a: 0.25 }, offset: { x: 0, y: 4 }, radius: 14, visible: true, blendMode: "NORMAL" });
    expect(fx[1]).toMatchObject({ type: "INNER_SHADOW", spread: 3 });
  });
});

describe("strokePlan", () => {
  const grey = [200, 200, 200, 1] as [number, number, number, number];
  const red = [255, 0, 0, 1] as [number, number, number, number];

  it("has nothing to draw without borders", () => {
    expect(strokePlan({}, 10, 10)).toEqual({ kind: "none" });
    expect(strokePlan({ strokes: { weights: [0, 0, 0, 0], colors: [null, null, null, null], uniform: true } }, 10, 10)).toEqual({ kind: "none" });
  });

  it("uses one stroke when every drawn side has the same colour", () => {
    expect(strokePlan({ strokes: { weights: [1, 2, 1, 0], colors: [grey, grey, grey, null], uniform: false } }, 10, 10)).toEqual({
      kind: "stroke",
      color: grey,
      uniform: false,
      weights: [1, 2, 1, 0],
    });
  });

  it("draws sides of different colours as rectangles", () => {
    const plan = strokePlan({ strokes: { weights: [1, 0, 2, 0], colors: [grey, null, red, null], uniform: false } }, 50, 20);
    expect(plan).toEqual({
      kind: "sides",
      rects: [
        { name: "border-top", x: 0, y: 0, w: 50, h: 1, color: grey },
        { name: "border-bottom", x: 0, y: 18, w: 50, h: 2, color: red },
      ],
    });
  });
});

describe("files and checks", () => {
  const svg = (json: string) => `<svg><metadata id="fs-scene">${json}</metadata></svg>`;

  it("reads scene metadata, or says why it cannot", () => {
    const meta = sampleMeta();
    expect(readSceneMeta(svg(JSON.stringify(meta)))).toEqual({ meta });
    expect(readSceneMeta("<svg/>")).toEqual({ error: "has no capture metadata. Capture again with the current extension." });
    expect(readSceneMeta(svg("{nope"))).toMatchObject({ error: expect.stringMatching(/^has metadata that is not valid JSON/) });
    expect(readSceneMeta(svg('{"version":2,"root":{}}'))).toEqual({ error: "has capture metadata of an unknown version." });
  });

  it("counts nodes", () => {
    expect(countNodes(sampleMeta().root)).toBe(7);
  });

  it("compares brightness only, within ±8 and ±48", () => {
    const img = (...v: number[]) => ({ width: v.length, height: 1, data: v.flatMap((x) => [x, x, x, 255]) });
    expect(compareBrightness(img(0, 0, 0, 0), img(0, 8, 9, 48))).toEqual({ sizeMatch: true, within8Pct: 50, within48Pct: 100 });
    expect(compareBrightness(img(0), img(0, 0))).toEqual({ sizeMatch: false, within8Pct: null, within48Pct: null });
  });

  it("checks boxes within half a pixel, ignoring text height", () => {
    const meta = sampleMeta();
    const geo = geometry(
      [
        { id: "n1", x: 20.5, y: 20, width: 200, height: 100 },
        { id: "n2", x: 30, y: 30, width: 40, height: 99 },
        { id: "n3", x: 240, y: 20.6, width: 24, height: 24 },
        { id: "unknown", x: 0, y: 0, width: 0, height: 0 },
      ],
      meta,
    );
    expect(geo).toEqual({ checked: 3, withinEps: 2, worst: 0.6, outside: [{ name: "svg", kind: "vector", delta: 0.6 }] });
  });

  it("writes the report text", () => {
    const lines = reportLines(
      [
        { id: "a", name: "A", kind: "frame", status: "exact" },
        { id: "b", name: "B", kind: "text", status: "pinned" },
      ],
      { "Arial → Arimo Regular": { how: "substitute", runs: 2, widthOk: 1, maxDelta: 1.5 } },
      { checked: 2, withinEps: 2, worst: 0, outside: [] },
      { brightnessWithin8Pct: 90, brightnessWithin48Pct: 99 },
      ["a note"],
      false,
    );
    expect(lines).toEqual([
      "Intent Capture Import",
      "",
      "2 layers: 1 exact, 1 pinned",
      "Geometry: 2 of 2 within 0.5 px (worst 0 px)",
      "Brightness vs screenshot: 90% within ±8, 99% within ±48",
      "Colour analysis: not attached",
      "",
      "Fonts:",
      "  Arial → Arimo Regular — substitute, 1/2 widths equal, max Δ 1.5 px",
      "",
      "Not exact:",
      "  pinned · text · B",
      "",
      "Notes:",
      "  a note",
    ]);
  });
});
