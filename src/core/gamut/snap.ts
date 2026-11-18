// The image's colours snapped onto the lattice (P-035 step 2): each colour goes
// to its nearest in-gamut lattice point, which then counts as occupied and is
// coloured in. Grid rounding is O(1); colours at the gamut edge, whose nearest
// grid point lies outside sRGB, search the surrounding cells.
import type { Rgb8 } from "../color/oklch";
import { gridIndex, type Lattice } from "./lattice";

export interface SnappedColors {
  /** Summed pixel share (0–100) of the colours snapped to each lattice point. */
  share: Float32Array;
  /** How many image colours snapped to each lattice point. */
  count: Uint32Array;
  /** Indices of occupied points. */
  occupied: Int32Array;
  /** Largest summed share, for sizing. */
  maxShare: number;
}

/** The nearest in-gamut lattice point to space coordinates (l, a, b). */
export function nearestPoint(lattice: Lattice, l: number, a: number, b: number): number {
  const { step, abLimit } = lattice.space;
  const [nL, nA, nB] = lattice.dims;
  const clamp = (v: number, n: number) => Math.min(n - 1, Math.max(0, v));
  const iL = clamp(Math.round(l / step), nL);
  const iA = clamp(Math.round((a + abLimit) / step), nA);
  const iB = clamp(Math.round((b + abLimit) / step), nB);
  const direct = lattice.cell[gridIndex(lattice.dims, iL, iA, iB)];
  if (direct >= 0) return direct;
  // Grow the search cube until it holds an in-gamut point; then the nearest of those wins.
  for (let r = 1; r < Math.max(nL, nA); r++) {
    let best = -1;
    let bestD = Infinity;
    for (let dl = -r; dl <= r; dl++)
      for (let da = -r; da <= r; da++)
        for (let db = -r; db <= r; db++) {
          const jl = iL + dl;
          const ja = iA + da;
          const jb = iB + db;
          if (jl < 0 || ja < 0 || jb < 0 || jl >= nL || ja >= nA || jb >= nB) continue;
          const k = lattice.cell[gridIndex(lattice.dims, jl, ja, jb)];
          if (k < 0) continue;
          const d = (lattice.l[k] - l) ** 2 + (lattice.a[k] - a) ** 2 + (lattice.b[k] - b) ** 2;
          if (d < bestD) {
            bestD = d;
            best = k;
          }
        }
    if (best >= 0) return best;
  }
  return -1;
}

export function snapColors(lattice: Lattice, colors: (Rgb8 & { percent: number })[]): SnappedColors {
  const share = new Float32Array(lattice.n);
  const count = new Uint32Array(lattice.n);
  for (const c of colors) {
    const [l, a, b] = lattice.space.toCoords(c);
    const k = nearestPoint(lattice, l, a, b);
    if (k < 0) continue;
    share[k] += c.percent;
    count[k]++;
  }
  const occupied: number[] = [];
  let maxShare = 0;
  for (let i = 0; i < lattice.n; i++)
    if (count[i] > 0) {
      occupied.push(i);
      if (share[i] > maxShare) maxShare = share[i];
    }
  return { share, count, occupied: Int32Array.from(occupied), maxShare };
}
