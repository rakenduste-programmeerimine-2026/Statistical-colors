// Harmony templates on the OKLCH hue wheel (#33, #57), fitted on the
// chromatic clusters only. A template counts when every spoke has a cluster
// within HARMONY_MAX_ERR and those clusters hold HARMONY_MIN_COVERAGE of the
// chromatic share; below that, random palettes pass too
// (docs/api/color-analysis.md).
import { deltaEOk } from "../color/oklch";
import type { ColorStructure, PaletteCluster, StructurePoint } from "./color-analysis";

/** Clusters below this chroma have no reliable hue (experiment E7). */
export const HARMONY_C0 = 0.04;
/** Largest hue error, degrees, for a cluster to sit on a spoke. */
export const HARMONY_MAX_ERR = 15;
/** Share of the chromatic pixels a template must explain. */
export const HARMONY_MIN_COVERAGE = 0.8;

export const HARMONY_TEMPLATES = [
  { code: "harmony.complementary", title: "Vastandvärvid", offsets: [0, 180] },
  { code: "harmony.analogous", title: "Naabervärvid", offsets: [-30, 0, 30] },
  { code: "harmony.triadic", title: "Kolmik", offsets: [0, 120, 240] },
  { code: "harmony.split-complementary", title: "Lõhestatud vastand", offsets: [0, 150, 210] },
  { code: "harmony.square", title: "Ruut", offsets: [0, 90, 180, 270] },
] as const;

const wrap = (h: number) => ((h % 360) + 360) % 360;
const hueDist = (a: number, b: number) => {
  const x = wrap(a - b);
  return Math.min(x, 360 - x);
};

interface Fit {
  rotation: number;
  /** Σ w·err² / Σ w over the clusters on spokes. */
  cost: number;
  coverage: number;
  residual: number;
  points: { cluster: PaletteCluster; spoke: number; err: number }[];
}

function fitTemplate(chroma: readonly PaletteCluster[], offsets: readonly number[]): Fit | undefined {
  const total = chroma.reduce((s, c) => s + c.share, 0);
  // Whole degrees, plus every rotation that puts a spoke exactly on a cluster (the dominant-hue anchor).
  const rotations = new Set<number>(Array.from({ length: 360 }, (_, r) => r));
  for (const c of chroma) for (const o of offsets) rotations.add(wrap(c.color.h! - o));
  let best: Fit | undefined;
  for (const r of rotations) {
    const points: Fit["points"] = [];
    const used = new Set<number>();
    let share = 0;
    let sq = 0;
    let abs = 0;
    for (const c of chroma) {
      let k = 0;
      for (let i = 1; i < offsets.length; i++) if (hueDist(c.color.h!, r + offsets[i]) < hueDist(c.color.h!, r + offsets[k])) k = i;
      const err = hueDist(c.color.h!, r + offsets[k]);
      if (err > HARMONY_MAX_ERR) continue;
      points.push({ cluster: c, spoke: k, err });
      used.add(k);
      share += c.share;
      sq += c.share * err * err;
      abs += c.share * err;
    }
    if (used.size < offsets.length || share / total < HARMONY_MIN_COVERAGE) continue;
    const cost = sq / share;
    if (!best || cost < best.cost - 1e-12) best = { rotation: r, cost, coverage: share / total, residual: abs / share, points };
  }
  return best;
}

/** Every template that fits, best first; a complementary inside a fitting square is marked nested. */
export function fitHarmonies(palette: readonly PaletteCluster[]): ColorStructure[] {
  const chroma = palette.filter((c) => c.color.h !== null && c.color.c >= HARMONY_C0);
  if (chroma.length < 2) return [];
  const found = HARMONY_TEMPLATES.flatMap((t) => {
    const fit = fitTemplate(chroma, t.offsets);
    if (!fit) return [];
    const score = fit.coverage * (1 - Math.sqrt(fit.cost) / HARMONY_MAX_ERR);
    const points: StructurePoint[] = fit.points.map(({ cluster, spoke }) => {
      const ideal = { l: cluster.color.l, c: cluster.color.c, h: wrap(fit.rotation + t.offsets[spoke]) };
      return { clusterId: cluster.id, ideal, actual: cluster.color, deltaE: deltaEOk(ideal, cluster.color), spoke };
    });
    return [{ t, fit, score, points }];
  });
  found.sort((a, b) => b.score - a.score);
  const structures: ColorStructure[] = found.map(({ t, fit, score, points }, i) => ({
    id: `s${i}`,
    code: t.code,
    family: "harmony",
    title: t.title,
    model: "oklch",
    laws: { l: "free", c: "free", h: "sym" },
    template: { offsets: [...t.offsets] },
    rotation: fit.rotation,
    points,
    coverage: fit.coverage,
    score,
    residual: fit.residual,
    meta: {
      provenance: "fitted",
      confidence: score,
      method: `template fit on the OKLCH hue, C ≥ ${HARMONY_C0}, spokes within ${HARMONY_MAX_ERR}°, coverage ≥ ${HARMONY_MIN_COVERAGE}`,
      requires: "pixels",
      caveats: ["consistent-not-proven"],
    },
  }));
  const square = structures.find((s) => s.code === "harmony.square");
  const comp = structures.find((s) => s.code === "harmony.complementary");
  if (square && comp && comp.points.every((p) => square.points.some((q) => q.clusterId === p.clusterId))) comp.nestedIn = [square.id];
  return structures;
}
