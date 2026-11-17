// D2 · Palette snap. A pixel that is not a declared colour, but lies on the
// blend line between two declared colours, takes the nearer of the two.
// Works on the lossless shot, or on another image passed in (the k× shot,
// D1's background plate). Saves snapped.png unless told another name.
import { canvasColor, parseColor, rectMask, rgbInt, type Pixels } from "../core/img.ts";
import { readPalette } from "../core/page-fns.ts";
import type { ApproachResult, Context } from "../core/pipeline.ts";

export type Rgb = [number, number, number];
export type SnapKind = "snapped" | "snappedSubpixel" | "unexplained";

/** Opaque declared colours, without duplicates. Translucent ones never appear as such on screen. */
export function buildPalette(colourStrings: string[], fallback?: Parameters<typeof parseColor>[1]): Rgb[] {
  const set = new Map<number, Rgb>();
  for (const s of colourStrings) {
    const c = parseColor(s, fallback);
    if (c && c[3] === 1) set.set(rgbInt(c[0], c[1], c[2]), [c[0], c[1], c[2]]);
  }
  return [...set.values()];
}

export type Classification = { to: Rgb | null; kind: SnapKind };

/** Values stored per palette pair, in this order, in one Float64Array. */
const F = { lo: 0, hi: 3, boxLo: 6, boxHi: 9, size: 12, stride: 13 } as const;

/**
 * Prepares a palette once, so each colour is classified without allocating.
 * Every pair also stores the bounding box a colour must lie in to be within
 * `tol` of that pair's blend line (t from −0.02 to 1.02), which skips most
 * pairs exactly, without changing any result (performance-analyst, P-025 item 3).
 */
export function makeClassifier(pal: Rgb[], tol: number): (r: number, g: number, b: number) => Classification {
  const pairs: [Rgb, Rgb][] = [];
  for (let i = 0; i < pal.length; i++) for (let j = i + 1; j < pal.length; j++) pairs.push([pal[i], pal[j]]);
  const v = new Float64Array(pairs.length * F.stride);
  pairs.forEach(([A, B], p) => {
    const o = p * F.stride;
    for (let c = 0; c < 3; c++) {
      const lo = Math.min(A[c], B[c]);
      const hi = Math.max(A[c], B[c]);
      const reach = tol + 0.02 * (hi - lo) + 1e-9;
      v[o + F.lo + c] = lo - reach;
      v[o + F.hi + c] = hi + reach;
      v[o + F.boxLo + c] = lo - 2;
      v[o + F.boxHi + c] = hi + 2;
    }
    v[o + F.size] = Math.abs(A[0] - B[0]) + Math.abs(A[1] - B[1]) + Math.abs(A[2] - B[2]);
  });
  const within = (o: number, lo: number, hi: number, r: number, g: number, b: number) =>
    r >= v[o + lo] && r <= v[o + hi] && g >= v[o + lo + 1] && g <= v[o + hi + 1] && b >= v[o + lo + 2] && b <= v[o + hi + 2];

  return (r, g, b) => {
    let best: Rgb | null = null;
    let bestD = Infinity;
    for (let p = 0; p < pairs.length; p++) {
      if (!within(p * F.stride, F.lo, F.hi, r, g, b)) continue;
      const [A, B] = pairs[p];
      const dx = B[0] - A[0];
      const dy = B[1] - A[1];
      const dz = B[2] - A[2];
      const len2 = dx * dx + dy * dy + dz * dz;
      if (!len2) continue;
      let t = ((r - A[0]) * dx + (g - A[1]) * dy + (b - A[2]) * dz) / len2;
      if (t < -0.02 || t > 1.02) continue;
      t = Math.min(1, Math.max(0, t));
      const d = Math.hypot(r - (A[0] + t * dx), g - (A[1] + t * dy), b - (A[2] + t * dz));
      if (d < bestD) {
        bestD = d;
        best = t < 0.5 ? A : B;
      }
    }
    if (best && bestD <= tol) return { to: best, kind: "snapped" };
    // Subpixel text blends each channel by its own amount, so the colour lies in
    // the box between two palette colours rather than on the line.
    let boxBest: Rgb | null = null;
    let boxSize = Infinity;
    for (let p = 0; p < pairs.length; p++) {
      const o = p * F.stride;
      if (!within(o, F.boxLo, F.boxHi, r, g, b) || v[o + F.size] >= boxSize) continue;
      const [A, B] = pairs[p];
      boxSize = v[o + F.size];
      const da = Math.abs(r - A[0]) + Math.abs(g - A[1]) + Math.abs(b - A[2]);
      const db = Math.abs(r - B[0]) + Math.abs(g - B[1]) + Math.abs(b - B[2]);
      boxBest = da <= db ? A : B;
    }
    if (boxBest) return { to: boxBest, kind: "snappedSubpixel" };
    return { to: null, kind: "unexplained" };
  };
}

/** One colour against the palette. For many colours, use makeClassifier once. */
export const classify = (r: number, g: number, b: number, pal: Rgb[], tol: number) => makeClassifier(pal, tol)(r, g, b);

export interface SnapOptions {
  /** Largest distance from a blend line, in RGB units, that still snaps. */
  tol?: number;
  /** An undeclared colour covering at least this share of the image is treated as real. */
  flatShare?: number;
}

export function snap(img: Pixels, palette: Rgb[], mask: Uint8Array, { tol = 6, flatShare = 0.0005 }: SnapOptions = {}) {
  const n = img.width * img.height;
  const D = img.data;
  // Large flat areas of one colour are real even when undeclared, for example
  // a translucent colour composited over its backdrop...
  const hist = new Map<number, number>();
  for (let i = 0; i < n; i++) {
    if (mask[i]) continue;
    const k = rgbInt(D[i * 4], D[i * 4 + 1], D[i * 4 + 2]);
    hist.set(k, (hist.get(k) ?? 0) + 1);
  }
  const pal = palette.slice();
  const have = new Set(pal.map((c) => rgbInt(c[0], c[1], c[2])));
  let observed = 0;
  // ...unless the declared colours already explain them as blends: subpixel
  // text repeats the same few fringe colours often enough to look flat.
  const declared = makeClassifier(palette, tol);
  for (const [k, cnt] of hist) {
    if (cnt < n * flatShare || have.has(k)) continue;
    const q: Rgb = [k >> 16, (k >> 8) & 255, k & 255];
    if (declared(q[0], q[1], q[2]).kind !== "unexplained") continue;
    pal.push(q);
    have.add(k);
    observed++;
  }

  const out: Pixels = { width: img.width, height: img.height, data: new Uint8ClampedArray(D) };
  const classifyFull = makeClassifier(pal, tol);
  const cache = new Map<number, Classification>();
  const counts = { inPalette: 0, snapped: 0, snappedSubpixel: 0, unexplained: 0, masked: 0 };
  for (let i = 0; i < n; i++) {
    if (mask[i]) {
      counts.masked++;
      continue;
    }
    const o = i * 4;
    const key = rgbInt(D[o], D[o + 1], D[o + 2]);
    if (have.has(key)) {
      counts.inPalette++;
      continue;
    }
    let res = cache.get(key);
    if (!res) {
      res = classifyFull(D[o], D[o + 1], D[o + 2]);
      cache.set(key, res);
    }
    counts[res.kind]++;
    if (res.to) out.data.set(res.to, o);
  }
  return { image: out, counts, paletteSize: pal.length, observedFlatColours: observed, distinctBlendColours: cache.size };
}

export interface D2Options {
  source?: { image: Pixels } | null;
  extraPalette?: string[];
  name?: string;
}

export type D2Result = ApproachResult & {
  image: Pixels;
  report: {
    declaredColours: number;
    observedFlatColours: number;
    snappedPct: number;
    snappedSubpixelPct: number;
    unexplainedPct: number;
  } & Record<string, unknown>;
};

export const D2 = {
  id: "D2",
  title: "Palette snap",
  needsDebugger: false,
  async run(ctx: Context, { source = null, extraPalette = [], name = "snapped.png" }: D2Options = {}): Promise<D2Result> {
    const info = await ctx.info();
    const img = source?.image ?? (await ctx.shot());
    const scale = img.width / info.vw;
    const { colours, soft } = await ctx.once("palette", () => ctx.host.page(readPalette));
    // Computed styles can be oklch() and other formats; the canvas reads them as screen sRGB.
    const palette = buildPalette([...colours, ...extraPalette], canvasColor);
    const grown = soft.map((r) => ({ x: r.x - r.pad, y: r.y - r.pad, w: r.w + 2 * r.pad, h: r.h + 2 * r.pad }));
    const res = snap(img, palette, rectMask(img.width, img.height, grown, scale));
    await ctx.save(name, res.image);
    const n = img.width * img.height;
    const pct = (v: number) => Math.round((v / n) * 1e4) / 100;
    return {
      image: res.image,
      report: {
        sourcePixelSize: [img.width, img.height],
        declaredColours: palette.length,
        observedFlatColours: res.observedFlatColours,
        distinctBlendColours: res.distinctBlendColours,
        inPalettePct: pct(res.counts.inPalette),
        snappedPct: pct(res.counts.snapped),
        snappedSubpixelPct: pct(res.counts.snappedSubpixel),
        unexplainedPct: pct(res.counts.unexplained),
        maskedPct: pct(res.counts.masked),
      },
    };
  },
};
