import { describe, expect, it } from "vitest";
import { buildPalette, classify, D2, makeClassifier, snap, type Rgb } from "../src/approaches/d2-snap.ts";
import type { Pixels } from "../src/core/img.ts";
import { makeContext } from "../src/core/pipeline.ts";
import { fakeCodec, fakeHost, queuedCodec } from "./fake-host.ts";

const black: Rgb = [0, 0, 0];
const white: Rgb = [255, 255, 255];
const red: Rgb = [255, 0, 0];

function pixels(...colours: Rgb[]): Pixels {
  const data = new Uint8ClampedArray(colours.length * 4);
  colours.forEach((c, i) => data.set([...c, 255], i * 4));
  return { width: colours.length, height: 1, data };
}

describe("buildPalette", () => {
  it("keeps opaque declared colours once each", () => {
    expect(buildPalette(["rgb(0, 0, 0)", "rgba(0, 0, 0, 1)", "rgba(1, 2, 3, 0.5)", "rgb(255, 0, 0)"])).toEqual([black, red]);
  });

  it("reads other formats through the fallback", () => {
    expect(buildPalette(["oklch(0.6 0.2 30)"], () => [10, 20, 30, 1])).toEqual([[10, 20, 30]]);
  });
});

describe("classify", () => {
  it("snaps a blend to the nearer end", () => {
    expect(classify(60, 60, 60, [black, white], 6)).toEqual({ to: black, kind: "snapped" });
    expect(classify(200, 200, 200, [black, white], 6)).toEqual({ to: white, kind: "snapped" });
  });

  it.each([
    [6, "snapped"],
    [5, "snappedSubpixel"],
  ])("uses the tolerance %i as the boundary for a colour 5.66 off the line", (tol, kind) => {
    expect(classify(132, 128, 124, [black, white], tol).kind).toBe(kind);
  });

  it("falls back to the box test for subpixel text", () => {
    expect(classify(200, 120, 40, [black, white], 6)).toEqual({ to: black, kind: "snappedSubpixel" });
  });

  it("leaves a colour outside every pair unexplained", () => {
    expect(classify(0, 0, 255, [black, red], 6)).toEqual({ to: null, kind: "unexplained" });
    expect(classify(1, 1, 1, [black], 6).kind).toBe("unexplained");
  });
});

describe("snap", () => {
  it("snaps blends, keeps palette colours and skips masked pixels", () => {
    const img = pixels(black, [100, 100, 100], white, [0, 0, 255]);
    const res = snap(img, [black, white], new Uint8Array([0, 0, 0, 1]), { flatShare: 1 });
    expect([...res.image.data.subarray(4, 8)]).toEqual([0, 0, 0, 255]);
    expect(res.counts).toEqual({ inPalette: 2, snapped: 1, snappedSubpixel: 0, unexplained: 0, masked: 1 });
    expect(img.data[4]).toBe(100); // the input is not changed
  });

  it("treats a large flat undeclared colour as real", () => {
    const blue: Rgb = [0, 0, 255];
    const res = snap(pixels(blue, blue, blue, white), [white], new Uint8Array(4), { flatShare: 0.5 });
    expect(res.observedFlatColours).toBe(1);
    expect(res.counts.inPalette).toBe(4);
  });

  it("does not add a flat colour that the palette already explains as a blend", () => {
    const grey: Rgb = [128, 128, 128];
    const res = snap(pixels(grey, grey, black, white), [black, white], new Uint8Array(4), { flatShare: 0.25 });
    expect(res.observedFlatColours).toBe(0);
    expect(res.counts.snapped).toBe(2);
  });
});

describe("D2.run", () => {
  it("snaps the shot with the page's declared colours", async () => {
    const { host, saved } = fakeHost({ readPalette: { colours: ["rgb(0, 0, 0)", "rgb(255, 255, 255)"], soft: [] } });
    const ctx = makeContext(host, {}, queuedCodec([pixels(black, [100, 100, 100])]));
    const res = await D2.run(ctx);
    expect(res.report).toMatchObject({ declaredColours: 2, snappedPct: 50, inPalettePct: 50, maskedPct: 0 });
    expect([...saved.keys()]).toEqual(["shot.png", "snapped.png"]);
  });

  it("masks soft regions, scaled from CSS px to image px", async () => {
    const soft = [{ x: 0, y: 0, w: 400, h: 600, pad: 0, why: "img" }];
    const { host } = fakeHost({ readPalette: { colours: ["rgb(0, 0, 0)"], soft } });
    // PAGE is 800 CSS px wide, so this 4 px image is at scale 1/200: the region covers the left half.
    const res = await D2.run(makeContext(host, {}, queuedCodec([pixels(black, black, black, black)])));
    expect(res.report.maskedPct).toBe(50);
  });

  it("uses a given source, extra colours and file name", async () => {
    const { host, saved } = fakeHost({ readPalette: { colours: [], soft: [] } });
    const ctx = makeContext(host, {}, fakeCodec);
    const res = await D2.run(ctx, { source: { image: pixels(red, [130, 0, 0]) }, extraPalette: ["rgb(255, 0, 0)", "rgb(0, 0, 0)"], name: "x.png" });
    expect(res.report).toMatchObject({ declaredColours: 2, snappedPct: 50 });
    expect([...saved.keys()]).toEqual(["x.png"]);
  });
});

describe("makeClassifier", () => {
  // The reference algorithm without the bounding-box skip, to prove the skip changes nothing.
  function reference(r: number, g: number, b: number, pal: Rgb[], tol: number) {
    let best: Rgb | null = null;
    let bestD = Infinity;
    for (let i = 0; i < pal.length; i++)
      for (let j = i + 1; j < pal.length; j++) {
        const [A, B] = [pal[i], pal[j]];
        const d3 = [B[0] - A[0], B[1] - A[1], B[2] - A[2]];
        const len2 = d3[0] ** 2 + d3[1] ** 2 + d3[2] ** 2;
        if (!len2) continue;
        let t = ((r - A[0]) * d3[0] + (g - A[1]) * d3[1] + (b - A[2]) * d3[2]) / len2;
        if (t < -0.02 || t > 1.02) continue;
        t = Math.min(1, Math.max(0, t));
        const d = Math.hypot(r - (A[0] + t * d3[0]), g - (A[1] + t * d3[1]), b - (A[2] + t * d3[2]));
        if (d < bestD) [bestD, best] = [d, t < 0.5 ? A : B];
      }
    if (best && bestD <= tol) return { to: best, kind: "snapped" };
    let boxBest: Rgb | null = null;
    let size = Infinity;
    for (let i = 0; i < pal.length; i++)
      for (let j = i + 1; j < pal.length; j++) {
        const [A, B] = [pal[i], pal[j]];
        if (![r, g, b].every((v, c) => v >= Math.min(A[c], B[c]) - 2 && v <= Math.max(A[c], B[c]) + 2)) continue;
        const s = Math.abs(A[0] - B[0]) + Math.abs(A[1] - B[1]) + Math.abs(A[2] - B[2]);
        if (s < size) {
          size = s;
          const da = Math.abs(r - A[0]) + Math.abs(g - A[1]) + Math.abs(b - A[2]);
          const db = Math.abs(r - B[0]) + Math.abs(g - B[1]) + Math.abs(b - B[2]);
          boxBest = da <= db ? A : B;
        }
      }
    return boxBest ? { to: boxBest, kind: "snappedSubpixel" } : { to: null, kind: "unexplained" };
  }

  it("gives the same answer as the unskipped algorithm on 3000 random colours", () => {
    let seed = 7;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) % 256);
    const pal: Rgb[] = Array.from({ length: 12 }, () => [rnd(), rnd(), rnd()]);
    const fast = makeClassifier(pal, 6);
    for (let i = 0; i < 3000; i++) {
      // Half the samples sit near a blend line, where the skip matters.
      const [A, B] = [pal[i % 12], pal[(i * 5 + 1) % 12]];
      const t = (i % 100) / 99;
      const c = i % 2 ? ([rnd(), rnd(), rnd()] as Rgb) : (A.map((a, k) => Math.round(a + t * (B[k] - a) + (rnd() % 9) - 4)) as Rgb);
      expect(fast(...c)).toEqual(reference(...c, pal, 6));
    }
  });
});
