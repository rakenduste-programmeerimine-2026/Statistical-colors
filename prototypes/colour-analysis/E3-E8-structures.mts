// ⚠ UNVERIFIED PROTOTYPE, shared for the backend team (P-031 item 10).
// Written by Claude as an experiment; not part of the app, not built, not tested in CI.
// Please verify it and write your own tests before integrating anything into backend
// code. Results and limits: prototypes/colour-analysis/README.md.

// E3 + E8: a prototype colour-structure detector.
// - Clusters (complete linkage, ΔE_OK ≤ tau) from 8-bit sRGB colours with shares.
// - Harmony templates on the OKLCH hue circle: every template × rotation, cost
//   J = Σ w·d(h, r+p) / Σ w + λ·|P|; per point the ideal colour keeps L and C and
//   moves h to the spoke, so ΔE_OK is the distance to the ideal OKLCH structure.
// - Ramps by axis and path laws in OKLab: tonal ladder (h const, L equal steps),
//   iso-lightness equal-ΔE (L const, collinear, equal steps), hue sweep (L, C const, h equal steps).
// Run: node prototypes/colour-analysis/E3-E8-structures.mts
import { readFileSync } from "node:fs";

// ---------- colour maths (CSS Color 4 matrices) ----------
const toLin = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const mul = (m: number[][], v: number[]) => m.map((r) => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]);
const M1 = [[0.4122214694707629, 0.5363325372617349, 0.0514459932675022], [0.2119034958178251, 0.6806995506452344, 0.1073969535369406], [0.08830979473355, 0.2817188386871742, 0.6299787005613017]];
const M2 = [[0.210454268309314, 0.7936177747023054, -0.0040720430116193], [1.9779985324311684, -2.4285922420485799, 0.450593709617411], [0.0259040424655478, 0.7827717124575296, -0.8086757549230774]];
export type Lab = { L: number; a: number; b: number };
export type Lch = { L: number; C: number; h: number };
export const rgbToLab = (r: number, g: number, b: number): Lab => {
  const [L, a, bb] = mul(M2, mul(M1, [toLin(r / 255), toLin(g / 255), toLin(b / 255)]).map(Math.cbrt));
  return { L, a, b: bb };
};
export const lch = (p: Lab): Lch => ({ L: p.L, C: Math.hypot(p.a, p.b), h: ((Math.atan2(p.b, p.a) * 180) / Math.PI + 360) % 360 });
export const lab = (p: Lch): Lab => ({ L: p.L, a: p.C * Math.cos((p.h * Math.PI) / 180), b: p.C * Math.sin((p.h * Math.PI) / 180) });
export const dE = (p: Lab, q: Lab) => Math.hypot(p.L - q.L, p.a - q.a, p.b - q.b);
export const hueDist = (a: number, b: number) => {
  const x = (((a - b) % 360) + 360) % 360;
  return Math.min(x, 360 - x);
};

// ---------- clustering ----------
export type Cluster = { id: string; lab: Lab; lch: Lch; w: number };
/** Complete-linkage agglomeration: merge only when every pair is within tau. */
export function cluster(colors: { lab: Lab; w: number }[], tau = 0.02): Cluster[] {
  let groups = colors.map((c) => [c]);
  for (;;) {
    let best: [number, number] | null = null;
    let bestD = Infinity;
    for (let i = 0; i < groups.length; i++)
      for (let j = i + 1; j < groups.length; j++) {
        let worst = 0;
        for (const p of groups[i]) for (const q of groups[j]) worst = Math.max(worst, dE(p.lab, q.lab));
        if (worst <= tau && worst < bestD) [bestD, best] = [worst, [i, j]];
      }
    if (!best) break;
    groups[best[0]] = groups[best[0]].concat(groups[best[1]]);
    groups.splice(best[1], 1);
  }
  return groups.map((g, i) => {
    const w = g.reduce((s, c) => s + c.w, 0);
    const m = { L: 0, a: 0, b: 0 };
    for (const c of g) {
      m.L += (c.lab.L * c.w) / w;
      m.a += (c.lab.a * c.w) / w;
      m.b += (c.lab.b * c.w) / w;
    }
    return { id: `c${i}`, lab: m, lch: lch(m), w };
  });
}

// ---------- harmonies ----------
export const TEMPLATES: Record<string, number[]> = {
  complementary: [0, 180],
  analogous: [-30, 0, 30],
  triadic: [0, 120, 240],
  "split-complementary": [0, 150, 210],
  square: [0, 90, 180, 270],
  rectangle: [0, 60, 180, 240],
};
export type HarmonyFit = { code: string; rotation: number; cost: number; maxErr: number; points: { id: string; spoke: number; err: number; dE: number }[] };

export function fitHarmonies(cs: Cluster[], { c0 = 0.04, lambda = 2, maxErr = 15 } = {}): HarmonyFit[] {
  const chroma = cs.filter((c) => c.lch.C >= c0);
  if (chroma.length < 2) return [];
  const W = chroma.reduce((s, c) => s + c.w, 0);
  const fits: HarmonyFit[] = [];
  for (const [code, offs] of Object.entries(TEMPLATES)) {
    let best: HarmonyFit | null = null;
    for (let r = 0; r < 360; r += 0.5) {
      let cost = 0;
      let mx = 0;
      const used = new Set<number>();
      const pts = chroma.map((c) => {
        let k = 0;
        for (let i = 1; i < offs.length; i++) if (hueDist(c.lch.h, r + offs[i]) < hueDist(c.lch.h, r + offs[k])) k = i;
        const err = hueDist(c.lch.h, r + offs[k]);
        used.add(k);
        cost += (c.w / W) * err;
        mx = Math.max(mx, err);
        const ideal = lab({ L: c.lch.L, C: c.lch.C, h: (r + offs[k] + 360) % 360 });
        return { id: c.id, spoke: k, err, dE: dE(c.lab, ideal) };
      });
      // A template only counts when every spoke is used: an unused spoke is a missing colour.
      if (used.size < offs.length) continue;
      const total = cost + lambda * offs.length;
      if (!best || total < best.cost) best = { code: `harmony.${code}`, rotation: r, cost: total, maxErr: mx, points: pts };
    }
    if (best && best.maxErr <= maxErr) fits.push(best);
  }
  // Nesting: drop a template whose spokes are a superset of a fitting simpler one at the same rotation.
  return fits.sort((a, b) => a.cost - b.cost);
}

// ---------- ramps (axis and path laws) ----------
const mean = (v: number[]) => v.reduce((s, x) => s + x, 0) / v.length;
const cv = (v: number[]) => {
  const m = mean(v);
  return m ? Math.sqrt(mean(v.map((x) => (x - m) ** 2))) / m : Infinity;
};
/** Equal-step test on consecutive ΔE along an order. */
function steps(order: Cluster[]) {
  const s = order.slice(1).map((c, i) => dE(order[i].lab, c.lab));
  return { steps: s, cv: cv(s) };
}
/** Largest distance from the line through the first and last point, in OKLab. */
function lineResidual(order: Cluster[]) {
  const A = order[0].lab;
  const B = order[order.length - 1].lab;
  const d = [B.L - A.L, B.a - A.a, B.b - A.b];
  const len = Math.hypot(...d) || 1;
  let worst = 0;
  for (const p of order) {
    const v = [p.lab.L - A.L, p.lab.a - A.a, p.lab.b - A.b];
    const t = (v[0] * d[0] + v[1] * d[1] + v[2] * d[2]) / len;
    worst = Math.max(worst, Math.hypot(v[0] - (t * d[0]) / len, v[1] - (t * d[1]) / len, v[2] - (t * d[2]) / len));
  }
  return worst;
}
export type Ramp = { code: string; ids: string[]; stepCv: number; residual: number; meanStep: number };
export function findRamps(cs: Cluster[], { epsL = 0.02, epsH = 6, maxCv = 0.15, maxResidual = 0.01, minLen = 3 } = {}): Ramp[] {
  const out: Ramp[] = [];
  // Tonal ladders: groups of near-equal hue (chromatic) ordered by L, equal L steps.
  const chromatic = cs.filter((c) => c.lch.C >= 0.04);
  const byHue = groupBy(chromatic, (a, b) => hueDist(a.lch.h, b.lch.h) <= epsH);
  for (const g of byHue) {
    if (g.length < minLen) continue;
    const order = [...g].sort((a, b) => a.lch.L - b.lch.L);
    const ls = order.slice(1).map((c, i) => c.lch.L - order[i].lch.L);
    if (cv(ls) <= maxCv) out.push({ code: "ramp.tonal", ids: order.map((c) => c.id), stepCv: cv(ls), residual: 0, meanStep: mean(ls) });
  }
  // Iso-lightness: groups of near-equal L, ordered along the main direction, collinear and equal ΔE.
  const byL = groupBy(cs, (a, b) => Math.abs(a.lch.L - b.lch.L) <= epsL);
  for (const g of byL) {
    if (g.length < minLen) continue;
    const order = orderAlongAxis(g);
    const st = steps(order);
    const res = lineResidual(order);
    if (st.cv <= maxCv && res <= maxResidual) out.push({ code: "ramp.iso-lightness-equal-step", ids: order.map((c) => c.id), stepCv: st.cv, residual: res, meanStep: mean(st.steps) });
    // Hue sweep: same L and C, equal hue steps.
    const cs2 = g.filter((c) => c.lch.C >= 0.04);
    if (cs2.length >= minLen && cv(cs2.map((c) => c.lch.C)) < 0.05) {
      const hs = [...cs2].sort((a, b) => a.lch.h - b.lch.h);
      const gaps = hs.slice(1).map((c, i) => c.lch.h - hs[i].lch.h);
      if (cv(gaps) <= maxCv) out.push({ code: "ramp.hue-sweep", ids: hs.map((c) => c.id), stepCv: cv(gaps), residual: 0, meanStep: mean(gaps) });
    }
  }
  return out;
}
function groupBy<T>(xs: T[], near: (a: T, b: T) => boolean): T[][] {
  const groups: T[][] = [];
  for (const x of xs) {
    const g = groups.find((gr) => gr.every((y) => near(x, y)));
    if (g) g.push(x);
    else groups.push([x]);
  }
  return groups;
}
function orderAlongAxis(g: Cluster[]) {
  // Order by projection on the direction between the two farthest points.
  let [p, q] = [g[0], g[1]];
  for (const a of g) for (const b of g) if (dE(a.lab, b.lab) > dE(p.lab, q.lab)) [p, q] = [a, b];
  const d = [q.lab.L - p.lab.L, q.lab.a - p.lab.a, q.lab.b - p.lab.b];
  return [...g].sort((a, b) => (a.lab.L - p.lab.L) * d[0] + (a.lab.a - p.lab.a) * d[1] + (a.lab.b - p.lab.b) * d[2] - ((b.lab.L - p.lab.L) * d[0] + (b.lab.a - p.lab.a) * d[1] + (b.lab.b - p.lab.b) * d[2]));
}

// ---------- tests ----------
const isMain = process.argv[1]?.endsWith("E3-E8-structures.mts");
if (isMain) {
  let seed = 3;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const mk = (pts: Lch[], noiseH = 0): Cluster[] =>
    pts.map((p, i) => {
      const q = { ...p, h: (p.h + (rnd() - 0.5) * 2 * noiseH + 360) % 360 };
      return { id: `c${i}`, lch: q, lab: lab(q), w: 1 / pts.length };
    });
  const report = (name: string, cs: Cluster[]) => {
    const h = fitHarmonies(cs);
    const r = findRamps(cs);
    console.log(`\n${name}: ${cs.length} clusters`);
    for (const f of h.slice(0, 3)) console.log(`  ${f.code} rot ${f.rotation} maxErr ${f.maxErr.toFixed(1)}° cost ${f.cost.toFixed(2)} ΔE per point ${f.points.map((p) => p.dE.toFixed(3)).join(" ")}`);
    if (!h.length) console.log("  no harmony within 15°");
    for (const x of r) console.log(`  ${x.code} [${x.ids.join(",")}] step CV ${x.stepCv.toFixed(3)} residual ${x.residual.toFixed(4)} mean step ${x.meanStep.toFixed(3)}`);
  };
  report("exact triad, L/C varied", mk([{ L: 0.6, C: 0.15, h: 30 }, { L: 0.7, C: 0.12, h: 150 }, { L: 0.5, C: 0.1, h: 270 }]));
  report("noisy triad (±8°)", mk([{ L: 0.6, C: 0.15, h: 30 }, { L: 0.7, C: 0.12, h: 150 }, { L: 0.5, C: 0.1, h: 270 }], 8));
  report("complementary + neutrals", mk([{ L: 0.6, C: 0.15, h: 40 }, { L: 0.6, C: 0.14, h: 220 }, { L: 0.95, C: 0.005, h: 0 }, { L: 0.2, C: 0.01, h: 0 }]));
  report("HSL triad from red (built in HSL)", mk([{ L: 0.628, C: 0.258, h: 29.2 }, { L: 0.866, C: 0.295, h: 142.5 }, { L: 0.452, C: 0.313, h: 264.1 }]));
  report("tonal ladder (h 250, L 0.3..0.9 step 0.1)", mk([0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9].map((L) => ({ L, C: 0.1, h: 250 }))));
  const iso = Array.from({ length: 6 }, (_, i) => ({ L: 0.65, a: -0.1 + i * 0.04, b: 0.05 }));
  report("iso-lightness equal-ΔE ramp (a −0.1..0.1)", iso.map((p, i) => ({ id: `c${i}`, lab: p, lch: lch(p), w: 1 / 6 })));
  report("hue sweep (L 0.7, C 0.1, h 0..300 step 60)", mk([0, 60, 120, 180, 240, 300].map((h) => ({ L: 0.7, C: 0.1, h }))));

  // The real demo palette: 295 colours of the colour picker study.
  const demo = JSON.parse(readFileSync("src/adapters/demo/palette-analysis.json", "utf8")) as { colors: { r: number; g: number; b: number; percent: number }[] };
  const t0 = Date.now();
  const cs = cluster(demo.colors.map((c) => ({ lab: rgbToLab(c.r, c.g, c.b), w: c.percent / 100 })), 0.02);
  console.log(`\ndemo palette: 295 colours → ${cs.length} clusters (τ 0.02) in ${Date.now() - t0} ms; chromatic (C ≥ 0.04): ${cs.filter((c) => c.lch.C >= 0.04).length}`);
  report("demo palette", cs);
}
