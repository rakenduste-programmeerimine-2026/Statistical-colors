import { deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import type { Pixels } from "../src/core/img.ts";
import { parsePdfPage, pathsToSvg, pdfInBox, translatePath, type PdfPath } from "../src/core/pdf-paths.ts";
import { MAX_TRACE_PIXELS, quantiseLocal, simplify, traceRegion } from "../src/core/trace.ts";

/** An image from rows of characters: each character picks a colour. */
function art(rows: string[], colours: Record<string, number[]>): Pixels {
  const w = rows[0].length;
  const data = new Uint8ClampedArray(w * rows.length * 4);
  rows.forEach((row, y) => [...row].forEach((ch, x) => data.set([...colours[ch], 255], (y * w + x) * 4)));
  return { width: w, height: rows.length, data };
}
const WB = { ".": [255, 255, 255], "#": [0, 0, 0], r: [255, 0, 0] };

describe("simplify", () => {
  it("drops points on a straight line and keeps corners", () => {
    const line: [number, number][] = [[0, 0], [1, 0], [2, 0], [3, 0], [3, 1], [3, 2]];
    expect(simplify(line, 0.5)).toEqual([[0, 0], [3, 0], [3, 2]]);
  });

  it("leaves short lines alone", () => {
    expect(simplify([[0, 0], [1, 1], [2, 0]], 0.5)).toEqual([[0, 0], [1, 1], [2, 0]]);
  });
});

describe("traceRegion", () => {
  it("draws the commonest colour as the background and outlines the rest", () => {
    const img = art(["....", ".##.", ".##.", "...."], WB);
    const res = traceRegion(img, 0, 0, 4, 4, 2);
    expect(res).toEqual({
      svg: '<rect width="2" height="2" fill="rgb(255, 255, 255)"/><path fill-rule="evenodd" fill="rgb(0, 0, 0)" d="M0.5 0.5L1.5 0.5L1.5 1.5L0.5 1.5Z"/>',
      colours: 2,
      loops: 1,
    });
  });

  it("keeps a hole as a second loop of the even-odd path", () => {
    const img = art(["#####", "#...#", "#...#", "#...#", "#####", "....."], WB);
    expect(traceRegion(img, 0, 0, 5, 6, 1)?.loops).toBe(2);
  });

  it("keeps pixels touching only at a corner as separate shapes", () => {
    const img = art(["#...", ".#..", "....", "...."], WB);
    expect(traceRegion(img, 0, 0, 4, 4, 1)?.loops).toBe(2);
  });

  it.each([
    ["too many colours", art(["#r", ".#"], WB), { maxColours: 2 }],
    ["one pixel wide", art(["#", "."], WB), {}],
  ])("gives up on %s", (_, img, opts) => {
    expect(traceRegion(img, 0, 0, img.width, img.height, 1, opts)).toBeNull();
  });

  it("refuses a region above the size limit, before reading it", () => {
    const huge: Pixels = { width: 2000, height: 1000, data: new Uint8ClampedArray(0) };
    expect(2000 * 1000).toBeGreaterThan(MAX_TRACE_PIXELS);
    expect(traceRegion(huge, 0, 0, 2000, 1000, 1)).toBeNull();
    expect(quantiseLocal(huge, 0, 0, 2000, 1000)).toBeNull();
  });
});

describe("quantiseLocal", () => {
  it("snaps rare colours to the nearest common one", () => {
    const img = art(["####", "####", "...r"], { ...WB, r: [230, 230, 230] });
    const q = quantiseLocal(img, 0, 0, 4, 3, 0.2) as Pixels;
    expect([...q.data.subarray(11 * 4, 12 * 4)]).toEqual([255, 255, 255, 255]);
    expect([...q.data.subarray(0, 4)]).toEqual([0, 0, 0, 255]);
  });

  it("gives null when no colour is common enough or the region is empty", () => {
    expect(quantiseLocal(art(["#.r"], WB), 0, 0, 3, 1, 0.5)).toBeNull();
    expect(quantiseLocal(art(["#."], WB), 5, 5, 2, 2)).toBeNull();
  });
});

/** A one-page PDF in the shape Chrome writes, with the given content stream. */
function pdf(content: string, { compress = false, extra = "" } = {}) {
  const body = compress ? deflateSync(Buffer.from(content, "latin1")) : Buffer.from(content, "latin1");
  const filter = compress ? " /Filter /FlateDecode" : "";
  const head = Buffer.from(
    "%PDF-1.4\n1 0 obj\n<< /Type /Pages /Kids [2 0 R] >>\nendobj\n" +
      "2 0 obj\n<< /Type /Page /MediaBox [0 0 72 72] /Contents 3 0 R /Resources << /ExtGState << /G1 4 0 R >> >> >>\nendobj\n" +
      `3 0 obj\n<< /Length ${body.length}${filter} >>\nstream\n`,
    "latin1",
  );
  const tail = Buffer.from(`\nendstream\nendobj\n4 0 obj\n<< /ca 0.5 /LW 2 >>\nendobj\n${extra}%%EOF`, "latin1");
  return new Uint8Array(Buffer.concat([head, body, tail]));
}

describe("parsePdfPage", () => {
  it("reads a filled rectangle in CSS px with the origin top-left", async () => {
    // A 72 pt page is 96 CSS px. The square is 0..36 pt from the bottom: 48 px tall, at the bottom.
    const page = await parsePdfPage(pdf("1 0 0 rg 0 0 36 36 re f"));
    expect([page.width, page.height]).toEqual([96, 96]);
    expect(page.paths).toEqual([
      expect.objectContaining({ fill: "rgb(255, 0, 0)", stroke: null, bbox: [0, 48, 48, 96], opacity: 1, clips: [] }),
    ]);
    expect(page.paths[0].d).toBe("M0 96L48 96L48 48L0 48Z");
  });

  it("reads compressed content, strokes, opacity from graphics states and text origins", async () => {
    const content = "q /G1 gs 0 0 1 RG 0 0 m 72 72 l S Q BT /F1 12 Tf 10 20 Td <00010002> Tj ET";
    const page = await parsePdfPage(pdf(content, { compress: true }));
    expect(page.paths[0]).toMatchObject({ fill: null, stroke: "rgb(0, 0, 255)", strokeWidth: 2.667, opacity: 1 });
    expect(page.texts).toEqual([{ x: 13.333, y: 69.333, size: 16, glyphs: 2, fill: "rgb(0, 0, 0)" }]);
  });

  it("cuts paths with the clip that applies to them", async () => {
    const page = await parsePdfPage(pdf("q 0 0 18 18 re W n 0 g 0 0 36 36 re f Q 0 0 9 9 re f"));
    expect(page.paths[0].clips).toEqual(["M0 96L24 96L24 72L0 72Z"]);
    expect(page.paths[1].clips).toEqual([]);
  });

  it("refuses a file without a page", async () => {
    await expect(parsePdfPage(new TextEncoder().encode("%PDF-1.4\n1 0 obj\n<< >>\nendobj\n"))).rejects.toThrow("No page object");
  });
});

describe("PDF path helpers", () => {
  const path = (over: Partial<PdfPath>): PdfPath => ({
    d: "M0 0L10 0L10 10Z",
    fill: "rgb(0, 0, 0)",
    evenodd: false,
    stroke: null,
    strokeWidth: 0,
    opacity: 1,
    bbox: [0, 0, 10, 10],
    order: 0,
    clips: [],
    ...over,
  });

  it("selects paths and text inside a box, with padding", () => {
    const page = { width: 100, height: 100, paths: [path({}), path({ bbox: [50, 50, 60, 60] }), path({ fill: null })], texts: [{ x: 11, y: 5, size: 10, glyphs: 1, fill: "x" }] };
    const got = pdfInBox(page, 0, 0, 10, 10);
    expect(got.paths).toHaveLength(1);
    expect(got.texts).toHaveLength(1);
    expect(pdfInBox(page, 0, 0, 10, 10, 0).texts).toHaveLength(0);
  });

  it("writes SVG, skipping pattern fills and shifting when asked", () => {
    expect(pathsToSvg([path({ evenodd: true, opacity: 0.5 }), path({ fill: "pattern" })])).toBe(
      '<path d="M0 0L10 0L10 10Z" fill="rgb(0, 0, 0)" fill-rule="evenodd" opacity="0.5"/>',
    );
    expect(pathsToSvg([path({ fill: null, stroke: "rgb(1, 2, 3)", strokeWidth: 2 })], 5, 0)).toBe(
      '<g transform="translate(-5 0)"><path d="M0 0L10 0L10 10Z" fill="none" stroke="rgb(1, 2, 3)" stroke-width="2"/></g>',
    );
    expect(pathsToSvg([path({ clips: ["M0 0Z"] })])).toMatch(/^<clipPath id="fs-pc-\d+"><path d="M0 0Z"\/><\/clipPath><g clip-path="url\(#fs-pc-\d+\)"><path/);
  });

  it("translates every point of a path", () => {
    expect(translatePath("M0 0L10 -5C1.5 2 3 4 5 6Z", 1, -1)).toBe("M1 -1L11 -6C2.5 1 4 3 6 5Z");
  });
});
