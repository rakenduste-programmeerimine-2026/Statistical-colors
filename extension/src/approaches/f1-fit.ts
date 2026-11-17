// F1 · Fit by re-rendering. For content with no DOM behind it (drawn into a
// <canvas>): assume a flat foreground on a flat background, propose shapes and
// text, draw each proposal with this browser's own rasteriser, and keep the
// one whose pixels match. An exact match (residual 0) proves that the fitted
// vector reproduces the capture; anything else is reported with its residual.
// No debugger needed. Saves fit.json and fit.svg.
import { blobToDataUrl, crop, parseColor, type Pixels } from "../core/img.ts";
import { fontFamilies, listRasterTargets, type RasterTarget } from "../core/page-fns.ts";
import type { ApproachResult, Context, Env } from "../core/pipeline.ts";
import type { RgbaTuple, SceneNode } from "../core/scene.ts";
import { SUBSTITUTES } from "./s2-scene.ts";

/**
 * Fonts worth trying when the page gives no hint. Installed fonts and glyph
 * smoothing differ per OS, which is why the popup asks for it.
 */
export const OS_FONTS: Record<string, string[]> = {
  win: ["Segoe UI", "Arial", "Tahoma", "Verdana", "Calibri", "Times New Roman", "Consolas", "Courier New"],
  mac: ["-apple-system", "Helvetica Neue", "Helvetica", "Arial", "Menlo", "Times"],
  linux: ["DejaVu Sans", "Liberation Sans", "Noto Sans", "Ubuntu", "Cantarell", "DejaVu Sans Mono", "Liberation Serif"],
  cros: ["Roboto", "Noto Sans", "Arial"],
  android: ["Roboto", "Noto Sans"],
};
const GENERIC = ["sans-serif", "serif", "monospace", "system-ui"];

/** Limits for one F1 run (P-025 item 4). */
export const MAX_TARGETS = 8;
export const TARGET_MS = 45_000;
export const TOTAL_MS = 120_000;

export interface FitHint {
  family: string;
  size: number;
  weight: number;
}

export interface FitOptions {
  fonts?: string[];
  hint?: FitHint;
  maxMs: number;
  /** Draw on an opaque canvas, which lets the browser use subpixel text smoothing. */
  opaque?: boolean;
}

type Band = { x0: number; x1: number; y0: number; y1: number };

export type FitItem =
  | { kind: "rect"; x: number; y: number; w: number; h: number; r: number; fill: string; analyticFirstGuess: Record<string, number>; residual: number; maxDiff: number; exact: boolean; svg: string }
  | {
      kind: "text";
      text: string;
      family: string;
      size: number;
      weight: number;
      x: number;
      y: number;
      fill: string;
      width: number;
      ascent: number;
      descent: number;
      residual: number;
      maxDiff: number;
      exact: boolean;
      inkPixels: number;
      svg: string;
    }
  | { kind: "skipped" | "none"; reason: string; band: Band; exact?: false; svg?: undefined };

export interface FitRegionResult {
  width: number;
  height: number;
  background: string;
  items: FitItem[];
  ms: number;
}

// ---- runs inside the page: self-contained, see core/page-fns.ts -------------
export async function fitRegion(targetUrl: string, opts: FitOptions): Promise<FitRegionResult> {
  type Rgb = [number, number, number];
  type Score = { sum: number; max: number };
  type Hyp = { family: string; weight: number; size: number; x: number; y: number; first: string; s: number };
  const t0 = performance.now();
  const late = (share = 1) => performance.now() - t0 > opts.maxMs * share;
  // Lets the page repaint now and then, so the tab does not freeze while fitting.
  let lastYield = t0;
  const breathe = async () => {
    if (performance.now() - lastYield < 50) return;
    await new Promise((r) => setTimeout(r, 0));
    lastYield = performance.now();
  };
  const img = new Image();
  img.src = targetUrl;
  await img.decode();
  const W = img.width;
  const H = img.height;
  const tc = document.createElement("canvas");
  tc.width = W;
  tc.height = H;
  const tctx = tc.getContext("2d", { willReadFrequently: true });
  if (!tctx) throw new Error("Canvas 2D is not available in this page.");
  tctx.drawImage(img, 0, 0);
  const T = tctx.getImageData(0, 0, W, H).data;
  const key = (i: number) => (T[i] << 16) | (T[i + 1] << 8) | T[i + 2];
  const rgb = (k: number): Rgb => [k >> 16, (k >> 8) & 255, k & 255];
  const css = (c: number[]) => `rgb(${c[0]}, ${c[1]}, ${c[2]})`;

  // The background is the most common colour.
  const hist = new Map<number, number>();
  for (let i = 0; i < W * H * 4; i += 4) hist.set(key(i), (hist.get(key(i)) ?? 0) + 1);
  const bgK = [...hist].sort((a, b) => b[1] - a[1])[0][0];
  const bg = rgb(bgK);
  const ink = new Uint8Array(W * H);
  for (let p = 0; p < W * H; p++) ink[p] = key(p * 4) !== bgK ? 1 : 0;

  // Horizontal bands separated by empty rows; one item per band.
  const rowInk = Array.from({ length: H }, (_, y) => {
    for (let x = 0; x < W; x++) if (ink[y * W + x]) return true;
    return false;
  });
  const bands: Band[] = [];
  for (let y = 0; y < H; y++) {
    if (!rowInk[y]) continue;
    let y1 = y;
    while (y1 + 1 < H && rowInk[y1 + 1]) y1++;
    let x0 = W;
    let x1 = -1;
    for (let yy = y; yy <= y1; yy++) {
      for (let x = 0; x < W; x++) {
        if (!ink[yy * W + x]) continue;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
      }
    }
    bands.push({ x0, x1, y0: y, y1 });
    y = y1;
  }

  const cc = document.createElement("canvas");
  cc.width = W;
  cc.height = H;
  const c = cc.getContext("2d", { willReadFrequently: true, alpha: !opts.opaque });
  if (!c) throw new Error("Canvas 2D is not available in this page.");
  // L1 distance between the candidate drawing and the target over a rectangle.
  const score = (xa: number, xb: number, ya: number, yb: number): Score => {
    xa = Math.max(0, Math.floor(xa));
    xb = Math.min(W, Math.ceil(xb));
    ya = Math.max(0, ya);
    yb = Math.min(H, yb);
    if (xb <= xa || yb <= ya) return { sum: 0, max: 0 };
    const D = c.getImageData(xa, ya, xb - xa, yb - ya).data;
    let sum = 0;
    let max = 0;
    let j = 0;
    for (let y = ya; y < yb; y++) {
      let o = (y * W + xa) * 4;
      for (let x = xa; x < xb; x++, o += 4, j += 4) {
        const d = Math.abs(D[j] - T[o]) + Math.abs(D[j + 1] - T[o + 1]) + Math.abs(D[j + 2] - T[o + 2]);
        sum += d;
        if (d > max) max = d;
      }
    }
    return { sum, max };
  };
  // Clears the rows of the band being fitted plus a margin wider than any score
  // area; the whole canvas is cleared once per band and before the whole-region
  // score (P-025 item 4).
  let area: Band = { x0: 0, x1: W, y0: 0, y1: H };
  const clear = (whole = false) => {
    c.fillStyle = css(bg);
    if (whole) c.fillRect(0, 0, W, H);
    else c.fillRect(area.x0, area.y0, area.x1 - area.x0, area.y1 - area.y0);
  };
  clear(true);

  const items: FitItem[] = [];
  for (const b of bands) {
    if (late()) {
      items.push({ kind: "skipped", reason: "time budget", band: b });
      continue;
    }
    // Full-width rows around the band: a wide glyph may be scored past the band's right edge.
    area = { x0: 0, x1: W, y0: Math.max(0, b.y0 - 4), y1: Math.min(H, b.y1 + 5) };
    clear(true);
    const bw = b.x1 - b.x0 + 1;
    const bh = b.y1 - b.y0 + 1;
    // The foreground is the band colour farthest from the background.
    let fg: Rgb = bg;
    let far = -1;
    const bandHist = new Map<number, number>();
    for (let y = b.y0; y <= b.y1; y++) {
      for (let x = b.x0; x <= b.x1; x++) {
        const k = key((y * W + x) * 4);
        bandHist.set(k, (bandHist.get(k) ?? 0) + 1);
      }
    }
    for (const [k, n] of bandHist) {
      const q = rgb(k);
      const d = Math.abs(q[0] - bg[0]) + Math.abs(q[1] - bg[1]) + Math.abs(q[2] - bg[2]);
      if (d > far || (d === far && n > (bandHist.get((fg[0] << 16) | (fg[1] << 8) | fg[2]) ?? 0))) {
        far = d;
        fg = q;
      }
    }
    const span = fg.map((v, i) => v - bg[i]);
    const len2 = span.reduce((s, v) => s + v * v, 0) || 1;
    const alpha = (x: number, y: number) => {
      const o = (y * W + x) * 4;
      return Math.min(1, Math.max(0, ((T[o] - bg[0]) * span[0] + (T[o + 1] - bg[1]) * span[1] + (T[o + 2] - bg[2]) * span[2]) / len2));
    };
    let inkArea = 0;
    let solid = 0;
    for (let y = b.y0; y <= b.y1; y++) {
      for (let x = b.x0; x <= b.x1; x++) {
        const a = alpha(x, y);
        inkArea += a;
        if (a > 0.99) solid++;
      }
    }

    // ---------- shape: a filled, possibly rounded, rectangle ----------
    if (solid / (bw * bh) > 0.6 && bw > 4 && bh > 4) {
      type Q = { x0: number; y0: number; x1: number; y1: number; r: number };
      // Partly covered edge pixels encode the sub-pixel position: coverage sums give the size.
      const mid = (a: number, n: number) => Array.from({ length: n }, (_, i) => a + i).slice(Math.floor(n / 3), Math.ceil((2 * n) / 3) + 1);
      const med = (v: number[]) => v.sort((p, q) => p - q)[v.length >> 1];
      const avg = (v: number[]) => v.reduce((p, q) => p + q, 0) / v.length;
      const rowsM = mid(b.y0, bh);
      const colsM = mid(b.x0, bw);
      const w = med(rowsM.map((y) => {
        let s = 0;
        for (let x = b.x0; x <= b.x1; x++) s += alpha(x, y);
        return s;
      }));
      const h = med(colsM.map((x) => {
        let s = 0;
        for (let y = b.y0; y <= b.y1; y++) s += alpha(x, y);
        return s;
      }));
      // Straight edges: averaged over the middle third, clear of the corners.
      let e: Q = {
        x0: b.x0 + 1 - avg(rowsM.map((y) => alpha(b.x0, y))),
        x1: b.x1 + avg(rowsM.map((y) => alpha(b.x1, y))),
        y0: b.y0 + 1 - avg(colsM.map((x) => alpha(x, b.y0))),
        y1: b.y1 + avg(colsM.map((x) => alpha(x, b.y1))),
        r: Math.sqrt(Math.max(0, w * h - inkArea) / (4 - Math.PI)),
      };
      const toP = (q: Q) => ({ x: q.x0, y: q.y0, w: q.x1 - q.x0, h: q.y1 - q.y0, r: q.r });
      const draw = (q: Q) => {
        clear();
        c.fillStyle = css(fg);
        c.beginPath();
        c.roundRect(q.x0, q.y0, q.x1 - q.x0, q.y1 - q.y0, Math.max(0, q.r));
        c.fill();
        return score(b.x0 - 2, b.x1 + 3, b.y0 - 2, b.y1 + 3);
      };
      const analytic = toP(e);
      let best = draw(e);
      const keys = ["x0", "y0", "x1", "y1", "r"] as const;
      const tryQ = (q: Q, orEqual = false) => {
        if (q.r < 0 || q.x1 <= q.x0 || q.y1 <= q.y0) return false;
        const sc = draw(q);
        if (sc.sum < best.sum || (orEqual && sc.sum === best.sum)) {
          best = sc;
          e = q;
          return true;
        }
        return false;
      };
      const r2 = (v: number) => Math.round(v * 100) / 100;
      // 1. The radius: a one-dimensional scan, coarse then fine.
      const rMax = Math.min(e.x1 - e.x0, e.y1 - e.y0) / 2;
      for (let r = 0; r <= rMax && !late(); r += 0.25) {
        tryQ({ ...e, r });
        await breathe();
      }
      for (let r = Math.max(0, e.r - 0.25), end = e.r + 0.25; r <= end && !late(); r += 0.01) tryQ({ ...e, r: r2(r) });
      // 2. People type round numbers: prefer the roundest value that fits no worse.
      const snapAll = () => {
        for (const k of keys) {
          for (const g of [1, 0.5, 0.25, 0.1, 0.05, 0.01]) {
            const v = r2(Math.round(e[k] / g) * g);
            if (Math.abs(v - e[k]) > 0.06) continue;
            if (Math.abs(v - e[k]) < 1e-9 || tryQ({ ...e, [k]: v }, true)) break;
          }
        }
      };
      snapAll();
      // 3. Rasterisers quantise coverage (here to quarter-pixel rows), so a
      //    straight edge fixes its position only within a plateau. The corners
      //    break the tie: the plateau is searched jointly.
      if (best.sum > 0) {
        const base = { ...e };
        const xs0 = new Set([base.x0, r2(Math.round(base.x0 / 0.05) * 0.05)]);
        const xs1 = new Set([base.x1, r2(Math.round(base.x1 / 0.05) * 0.05)]);
        search: for (const x0 of xs0) {
          for (const x1 of xs1) {
            for (let i = -5; i <= 5; i++) {
              for (let j = -5; j <= 5; j++) {
                for (let k = -6; k <= 6; k++) {
                  tryQ({ x0, x1, y0: r2(base.y0 + i * 0.05), y1: r2(base.y1 + j * 0.05), r: r2(base.r + k * 0.05) });
                  if (best.sum === 0 || late()) break search;
                }
                await breathe();
              }
            }
          }
        }
        let improved = true;
        while (improved && best.sum > 0 && !late()) {
          improved = false;
          for (const k of keys) for (const step of [0.01, -0.01]) if (tryQ({ ...e, [k]: r2(e[k] + step) })) improved = true;
          await breathe();
        }
        snapAll();
      }
      const p = toP(e);
      const round = (v: number) => Math.round(v * 1e4) / 1e4;
      items.push({
        kind: "rect",
        x: round(p.x),
        y: round(p.y),
        w: round(p.w),
        h: round(p.h),
        r: round(p.r),
        fill: css(fg),
        analyticFirstGuess: Object.fromEntries(Object.entries(analytic).map(([k, v]) => [k, round(v)])),
        residual: best.sum,
        maxDiff: best.max,
        exact: best.sum === 0,
        svg: `<rect x="${round(p.x)}" y="${round(p.y)}" width="${round(p.w)}" height="${round(p.h)}" rx="${round(p.r)}" fill="${css(fg)}"/>`,
      });
      continue;
    }

    // ---------- a line of text ----------
    // The baseline is the lowest row still carrying a good share of the ink
    // (descenders below it are sparse); the cap height then bounds the size.
    const rowCount = Array.from({ length: bh }, (_, i) => {
      let n = 0;
      for (let x = b.x0; x <= b.x1; x++) n += ink[(b.y0 + i) * W + x];
      return n;
    });
    const peak = Math.max(...rowCount);
    let baseRow = bh - 1;
    while (baseRow > 0 && rowCount[baseRow] < peak * 0.35) baseRow--;
    const baseY = b.y0 + baseRow + 1;
    const capH = baseY - b.y0;
    const CH = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,:;!?-_()[]/\\'\"@#$%&*+=<>".split("");
    const fontStr = (f: { weight: number; size: number; family: string }) => `${f.weight} ${f.size}px ${/^[a-z-]+$/.test(f.family) ? f.family : `"${f.family}"`}`;
    const sizes = opts.hint?.size ? [opts.hint.size] : [];
    if (!sizes.length) for (let z = Math.floor((capH / 0.82) * 2) / 2; z <= capH / 0.6 + 0.5; z += 0.5) sizes.push(z);
    const weights = opts.hint?.weight ? [opts.hint.weight] : [400, 700];
    // Only families that really are available: a missing one renders in a
    // fallback face and would put the wrong name on the result. Aliases that
    // measure the same as an earlier family are dropped too.
    const probe = "mmmmmmmmmmlli@#Wj";
    const gen = ["monospace", "serif", "sans-serif"];
    const pw = (font: string) => {
      c.font = `72px ${font}`;
      return c.measureText(probe).width;
    };
    const basePw = gen.map(pw);
    const isGeneric = (f: string) => /^(serif|sans-serif|monospace|system-ui|-apple-system)$/.test(f);
    const seenSig = new Set<string>();
    const families: string[] = [];
    const missing: string[] = [];
    for (const fam of opts.hint?.family ? [opts.hint.family] : (opts.fonts ?? [])) {
      if (!isGeneric(fam) && !gen.some((g, i) => pw(`"${fam}", ${g}`) !== basePw[i])) {
        missing.push(fam);
        continue;
      }
      c.font = fontStr({ weight: 400, size: 72, family: fam });
      const m = c.measureText(probe);
      const sig = `${m.width.toFixed(2)}|${m.actualBoundingBoxAscent.toFixed(2)}|${m.actualBoundingBoxDescent.toFixed(2)}`;
      if (!seenSig.has(sig)) {
        seenSig.add(sig);
        families.push(fam);
      }
    }
    if (!families.length) {
      items.push({ kind: "none", reason: `font not available: ${missing.join(", ")}`, band: b });
      continue;
    }
    const hyps: Hyp[] = [];
    c.textBaseline = "alphabetic";
    outer: for (const family of families) {
      for (const weight of weights) {
        for (const size of sizes) {
          const h = { family, weight, size };
          c.font = fontStr(h);
          for (const ch of CH) {
            const m = c.measureText(ch);
            const iw = m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
            if (m.actualBoundingBoxAscent > capH + 1.5 || iw < 1) continue;
            // Judged over the glyph's own advance at quarter-pixel origins: DOM
            // text sits at fractions of a pixel, canvas text usually at whole ones.
            const bx = b.x0 + m.actualBoundingBoxLeft;
            const xEnd = Math.max(b.x0 + 2, bx + m.width - 0.5);
            for (const x of new Set([Math.round(bx), ...[-0.5, -0.25, 0, 0.25, 0.5].map((q) => Math.round(bx * 4) / 4 + q)])) {
              for (const y of [baseY, baseY - 0.5, baseY + 0.5]) {
                clear();
                c.fillStyle = css(fg);
                c.fillText(ch, x, y);
                const sc = score(b.x0 - 1, xEnd, b.y0 - 1, b.y1 + 2);
                hyps.push({ ...h, x, y, first: ch, s: sc.sum / Math.max(1, xEnd - b.x0 + 1) });
              }
            }
            if (late(0.5)) break outer;
            await breathe();
          }
        }
      }
    }
    hyps.sort((p, q) => p.s - q.s);
    const top: Hyp[] = [];
    const sig = new Set<string>();
    for (const h of hyps) {
      const k = `${h.family}|${h.weight}|${h.size}|${h.first}`;
      if (!sig.has(k)) {
        sig.add(k);
        top.push(h);
      }
      if (top.length >= 10) break;
    }
    if (!top.length) {
      items.push({ kind: "none", reason: "no font candidate matches the first glyph", band: b });
      continue;
    }

    // Beam search over the rest of the line, one character at a time.
    let bestLine: { h: Hyp; text: string; residual: number; maxDiff: number; regionResidual: number } | null = null;
    for (const h of top) {
      c.font = fontStr(h);
      let beam = [{ str: h.first, err: 0 }];
      const done: { str: string; err: number }[] = [];
      for (let step = 0; step < 90 && beam.length; step++) {
        const next: { str: string; err: number; dens: number }[] = [];
        for (const cand of beam) {
          if (h.x + c.measureText(cand.str).width >= b.x1 - 0.5) {
            done.push(cand);
            continue;
          }
          for (const ch of [...CH, " "]) {
            const str = cand.str + ch;
            const adv = h.x + c.measureText(str).width;
            clear();
            c.fillStyle = css(fg);
            c.fillText(str, h.x, h.y);
            const sc = score(b.x0 - 1, Math.min(adv, b.x1 + 2), b.y0 - 1, b.y1 + 2);
            next.push({ str, err: sc.sum, dens: sc.sum / Math.max(1, adv - b.x0) });
          }
        }
        next.sort((p, q) => p.dens - q.dens);
        beam = next.slice(0, 4);
        if (late()) {
          done.push(...beam);
          break;
        }
        await breathe();
      }
      for (const cand of done.length ? done : beam) {
        clear(true);
        c.fillStyle = css(fg);
        c.fillText(cand.str.trimEnd(), h.x, h.y);
        const whole = score(0, W, 0, H); // the whole region, so stray ink counts
        const full = score(b.x0 - 1, b.x1 + 2, b.y0 - 1, b.y1 + 2);
        if (!bestLine || full.sum < bestLine.residual) bestLine = { h, text: cand.str.trimEnd(), residual: full.sum, maxDiff: full.max, regionResidual: whole.sum };
      }
      if (late()) break;
    }
    if (!bestLine) {
      items.push({ kind: "skipped", reason: "time budget", band: b });
      continue;
    }
    // Sub-pixel polish of the origin with the whole string in place.
    c.font = fontStr(bestLine.h);
    for (const step of [0.5, 0.25, 0.125]) {
      for (const [dx, dy] of [[step, 0], [-step, 0], [0, step], [0, -step]]) {
        if (bestLine.residual === 0) break;
        clear();
        c.fillStyle = css(fg);
        c.fillText(bestLine.text, bestLine.h.x + dx, bestLine.h.y + dy);
        const sc = score(b.x0 - 1, b.x1 + 2, b.y0 - 1, b.y1 + 2);
        if (sc.sum < bestLine.residual) {
          bestLine.h = { ...bestLine.h, x: bestLine.h.x + dx, y: bestLine.h.y + dy };
          bestLine.residual = sc.sum;
          bestLine.maxDiff = sc.max;
        }
      }
    }
    const h = bestLine.h;
    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
    const tm = c.measureText(bestLine.text);
    items.push({
      kind: "text",
      text: bestLine.text,
      family: h.family,
      size: h.size,
      weight: h.weight,
      x: h.x,
      y: h.y,
      fill: css(fg),
      width: tm.width,
      ascent: tm.fontBoundingBoxAscent,
      descent: tm.fontBoundingBoxDescent,
      residual: bestLine.residual,
      maxDiff: bestLine.maxDiff,
      exact: bestLine.residual === 0,
      inkPixels: bw * bh,
      svg: `<text x="${h.x}" y="${h.y}" font-family="${esc(h.family)}" font-size="${h.size}" font-weight="${h.weight}" fill="${css(fg)}">${esc(bestLine.text)}</text>`,
    });
  }
  return { width: W, height: H, background: css(bg), items, ms: Math.round(performance.now() - t0) };
}
// ------------------------------------------------------------------------------

/** Fonts to try: the page's own, then the OS's usual ones, then the generic families. */
export function candidateFonts(env: Env | null | undefined, pageFonts: string[] = []): string[] {
  return [...new Set([...pageFonts, ...(OS_FONTS[env?.os ?? ""] ?? []), ...GENERIC])];
}

export async function fitImage(ctx: Context, image: Pixels, opts: Partial<FitOptions> = {}): Promise<FitRegionResult> {
  const url = await blobToDataUrl(await ctx.encode(image));
  return ctx.host.page(fitRegion, url, { maxMs: TARGET_MS, ...opts });
}

/** Whether a canvas is shown 1:1, which the fit needs: it draws at backing-store scale. */
export const shownOneToOne = (t: RasterTarget, dpr: number) =>
  t.backing !== null && Math.abs(t.backing[0] - t.w * dpr) < 1 && Math.abs(t.backing[1] - t.h * dpr) < 1;

/** The fitted items as scene nodes in page CSS px, for the S2 metadata. */
export function fittedNode(index: number, t: RasterTarget, res: FitRegionResult, sx: number, sy: number, dpr: number): SceneNode {
  const col = (c: string): RgbaTuple => {
    const p = parseColor(c);
    return p ? [p[0], p[1], p[2], p[3]] : [0, 0, 0, 1];
  };
  const children: SceneNode[] = [];
  res.items.forEach((i, n) => {
    const id = `f${index}_${n}`;
    if (i.kind === "rect") {
      children.push({
        id,
        kind: "frame",
        name: "fitted rect",
        confidence: i.exact ? "fitted-exact" : "fitted",
        box: [sx + i.x / dpr, sy + i.y / dpr, i.w / dpr, i.h / dpr],
        style: { fills: [{ type: "solid", color: col(i.fill) }], radii: [i.r / dpr, i.r / dpr, i.r / dpr, i.r / dpr] },
        children: [],
      });
    } else if (i.kind === "text") {
      children.push({
        id,
        kind: "text",
        name: i.text.slice(0, 40),
        confidence: i.exact ? "fitted-exact" : "fitted",
        box: [sx + i.x / dpr, sy + (i.y - i.ascent) / dpr, i.width / dpr, (i.ascent + i.descent) / dpr],
        text: {
          characters: i.text,
          usedFamily: i.family,
          substitute: SUBSTITUTES[i.family.toLowerCase()] ?? null,
          requested: [i.family],
          weight: i.weight,
          italic: false,
          size: i.size / dpr,
          lineHeight: (i.ascent + i.descent) / dpr,
          letterSpacing: 0,
          decoration: "none",
          fill: col(i.fill),
          baseline: sy + i.y / dpr,
          width: i.width / dpr,
        },
      });
    }
  });
  return {
    id: `f${index}`,
    kind: "frame",
    name: "canvas (fitted)",
    box: [sx, sy, t.w, t.h],
    source: { tag: "canvas", fitted: true },
    style: { fills: [{ type: "solid", color: col(res.background) }], clip: true },
    children,
  };
}

export type FitTarget = RasterTarget &
  Partial<FitRegionResult> & { skipped?: string; allExact?: boolean; svg?: string; metaNode?: SceneNode; snapped?: [number, number] };

export type F1Result = ApproachResult & { targets: FitTarget[]; fonts: string[] };

export const F1 = {
  id: "F1",
  title: "Fit by re-rendering",
  needsDebugger: false,
  async run(ctx: Context): Promise<F1Result> {
    const info = await ctx.info();
    const shot = await ctx.shot();
    const d = info.dpr;
    const targets = await ctx.host.page(listRasterTargets);
    const fonts = candidateFonts(ctx.opts.env, await ctx.host.page(fontFamilies));
    const started = performance.now();
    const out: FitTarget[] = [];
    for (const [index, t] of targets.entries()) {
      if (index >= MAX_TARGETS) {
        out.push({ ...t, skipped: `only the first ${MAX_TARGETS} canvases are fitted` });
        continue;
      }
      if (performance.now() - started > TOTAL_MS) {
        out.push({ ...t, skipped: "time budget for the whole run" });
        continue;
      }
      if (!shownOneToOne(t, d)) {
        out.push({ ...t, skipped: "canvas is scaled on screen; pixels are resampled" });
        continue;
      }
      await ctx.host.ping?.();
      const res = await fitImage(ctx, crop(shot, t.x * d, t.y * d, t.w * d, t.h * d), { fonts });
      // Where the browser actually put it.
      const sx = Math.round(t.x * d) / d;
      const sy = Math.round(t.y * d) / d;
      // A flat group, not a nested <svg>: importers treat nested SVGs inconsistently.
      const svg =
        `<g data-fitted-canvas="1" transform="translate(${sx} ${sy}) scale(${+(1 / d).toFixed(6)})">` +
        `<rect width="${res.width}" height="${res.height}" fill="${res.background}"/>${res.items.map((i) => i.svg ?? "").join("")}</g>`;
      const allExact = res.items.length > 0 && res.items.every((i) => i.exact);
      out.push({ ...t, ...res, allExact, svg, metaNode: fittedNode(index, t, res, sx, sy, d), snapped: [sx, sy] });
    }
    await ctx.save(
      "fit.json",
      JSON.stringify({ env: ctx.opts.env ?? null, fontsTried: fonts, targets: out.map(({ svg, metaNode, ...rest }) => (void svg, void metaNode, rest)) }, null, 1),
    );
    if (out.some((t) => t.svg)) {
      await ctx.save("fit.svg", `<svg xmlns="http://www.w3.org/2000/svg" width="${info.vw}" height="${info.vh}">${out.map((t) => t.svg ?? "").join("")}</svg>`);
    }
    const items = out.flatMap((t) => t.items ?? []);
    return {
      targets: out,
      fonts,
      report: {
        rasterTargets: targets.length,
        skipped: out.filter((t) => t.skipped).length,
        items: items.length,
        exactItems: items.filter((i) => i.exact).length,
        found: items.map((i) =>
          i.kind === "text"
            ? { kind: "text", text: i.text, font: `${i.weight} ${i.size}px ${i.family}`, residual: i.residual, exact: i.exact }
            : i.kind === "rect"
              ? { kind: "rect", x: i.x, y: i.y, w: i.w, h: i.h, r: i.r, residual: i.residual, exact: i.exact }
              : { kind: i.kind, reason: i.reason },
        ),
        ms: out.reduce((s, t) => s + (t.ms ?? 0), 0),
      },
    };
  },
};
