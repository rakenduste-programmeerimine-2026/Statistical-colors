// Share filter (#30) and complete-linkage clusters in OKLab (#31): the
// palette of colorAnalysis, and each colour's cluster (#69).
import { srgbToOklab, type Oklch, type Vec3 } from "../color/oklch";
import type { PaletteCluster } from "./color-analysis";
import type { ColorCount } from "./types";

/** Colours under this share (%) are dropped (#30). */
export const SHARE_FLOOR = 0.05;
/** Colours this far below the mean log10 share are dropped (#30). */
export const SHARE_Z_MIN = -2;
/** Merge threshold in ΔE_OK, about one just-noticeable difference (#31). */
export const CLUSTER_TAU = 0.02;
/** Only the most frequent kept colours are clustered, so the work stays bounded. */
export const MAX_CLUSTERED = 300;

const dist = (p: Vec3, q: Vec3) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);

/** Drops rare colours: share under the floor, or z < −2 on the log10 share. */
export function filterShares(colors: readonly ColorCount[]): { kept: ColorCount[]; removedShare: number } {
  const logs = colors.map((c) => Math.log10(Math.max(c.percent, 1e-12)));
  const mean = logs.reduce((s, x) => s + x, 0) / (logs.length || 1);
  const sd = Math.sqrt(logs.reduce((s, x) => s + (x - mean) ** 2, 0) / (logs.length || 1));
  const kept: ColorCount[] = [];
  let removedShare = 0;
  colors.forEach((c, i) => {
    if (c.percent < SHARE_FLOOR || (sd > 0 && (logs[i] - mean) / sd < SHARE_Z_MIN)) removedShare += c.percent;
    else kept.push(c);
  });
  return { kept, removedShare };
}

function toOklch([l, a, b]: Vec3): Oklch {
  const c = Math.hypot(a, b);
  return c < 0.000005 ? { l, c: 0, h: null } : { l, c, h: ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360 };
}

/**
 * Complete linkage: two clusters merge only while every pair of their members
 * is within `tau`, so ΔE chains do not grow without limit. Uses the
 * `MAX_CLUSTERED` most frequent colours; the palette is sorted by share.
 */
export function clusterColors(colors: readonly ColorCount[], tau = CLUSTER_TAU): PaletteCluster[] {
  return clusterWithMembers(colors, tau).palette;
}

/**
 * The palette and each clustered colour's cluster id (the same colours that
 * make up `share`, `pixelCount` and `memberCount`), keyed by the input object.
 */
export function clusterWithMembers(colors: readonly ColorCount[], tau = CLUSTER_TAU): { palette: PaletteCluster[]; memberOf: Map<ColorCount, string> } {
  const pts = [...colors].sort((x, y) => y.count - x.count).slice(0, MAX_CLUSTERED);
  const labs = pts.map((c) => srgbToOklab(c));
  const n = pts.length;
  const d = new Float64Array(n * n);
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) d[i * n + j] = d[j * n + i] = dist(labs[i], labs[j]);
  const members = pts.map((_, i) => [i]);
  const alive = new Array<boolean>(n).fill(true);
  for (;;) {
    let best = Infinity;
    let bi = -1;
    let bj = -1;
    for (let i = 0; i < n; i++) if (alive[i]) for (let j = i + 1; j < n; j++) if (alive[j] && d[i * n + j] < best) [best, bi, bj] = [d[i * n + j], i, j];
    if (best > tau) break;
    // Lance–Williams update for complete linkage: the new distance is the larger one.
    for (let k = 0; k < n; k++) if (alive[k]) d[bi * n + k] = d[k * n + bi] = Math.max(d[bi * n + k], d[bj * n + k]);
    members[bi].push(...members[bj]);
    alive[bj] = false;
  }
  const groups = members.filter((_, i) => alive[i]);
  const clusters = groups.map((g) => {
    const share = g.reduce((s, i) => s + pts[i].percent, 0);
    const centre: Vec3 = [0, 0, 0];
    for (const i of g) for (let k = 0; k < 3; k++) centre[k] += (labs[i][k] * pts[i].percent) / (share || 1);
    let spread = 0;
    for (const i of g) for (const j of g) spread = Math.max(spread, dist(labs[i], labs[j]));
    const rep = pts[Math.min(...g)];
    return {
      members: g,
      color: toOklch(centre),
      share,
      pixelCount: g.reduce((s, i) => s + pts[i].count, 0),
      memberCount: g.length,
      spreadDeltaE: spread,
      representativeRgb: { r: rep.r, g: rep.g, b: rep.b, ...(rep.a === undefined ? {} : { a: rep.a }) },
    };
  });
  const memberOf = new Map<ColorCount, string>();
  const palette = clusters
    .sort((x, y) => y.share - x.share)
    .map(({ members: g, ...c }, i): PaletteCluster => {
      for (const m of g) memberOf.set(pts[m], `c${i}`);
      return {
        id: `c${i}`,
        ...c,
        meta: { provenance: "measured", confidence: 1, method: `complete linkage in OKLab, τ ${tau}`, requires: "pixels" },
      };
    });
  return { palette, memberOf };
}
