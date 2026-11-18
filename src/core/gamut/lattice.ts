// The perceptual lattice: every point of a cubic grid in the chosen space that
// lies inside 8-bit sRGB (P-035, P-036). Typed arrays, built once per space.
import { linearToSrgb8 } from "../color/oklch";
import type { GamutSpace } from "./space";

/** The notebook's gamut tolerance (cell 19, GAMUT_TOL). */
const GAMUT_TOL = 1e-9;

export interface Lattice {
  space: GamutSpace;
  /** Number of in-gamut points. */
  n: number;
  /** Space coordinates per point: lightness, a, b. */
  l: Float32Array;
  a: Float32Array;
  b: Float32Array;
  /** sRGB bytes per point, r g b. */
  rgb: Uint8Array;
  /** Hue in degrees (NaN for neutrals) and chroma, in the space's own a, b. */
  hue: Float32Array;
  chroma: Float32Array;
  /** Stable random rank, for sampling like the notebook (cell 19, random_rank). */
  rank: Int32Array;
  /** Grid size and the grid cell → point index map (-1 outside the gamut). */
  dims: [number, number, number];
  cell: Int32Array;
}

export const gridIndex = (dims: [number, number, number], iL: number, iA: number, iB: number) => (iL * dims[1] + iA) * dims[2] + iB;

/** mulberry32, so the ranks are the same on every build. */
function prng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildLattice(space: GamutSpace): Lattice {
  const { step, lMax, abLimit } = space;
  const nL = Math.round(lMax / step) + 1;
  const nAB = 2 * Math.round(abLimit / step) + 1;
  const dims: [number, number, number] = [nL, nAB, nAB];
  const cell = new Int32Array(nL * nAB * nAB).fill(-1);
  const kept: number[] = [];
  const lin: number[] = [];
  for (let iL = 0; iL < nL; iL++) {
    const L = iL * step;
    for (let iA = 0; iA < nAB; iA++) {
      const a = iA * step - abLimit;
      for (let iB = 0; iB < nAB; iB++) {
        const b = iB * step - abLimit;
        const [r, g, bl] = space.toLinearSrgb(L, a, b);
        if (r < -GAMUT_TOL || g < -GAMUT_TOL || bl < -GAMUT_TOL || r > 1 + GAMUT_TOL || g > 1 + GAMUT_TOL || bl > 1 + GAMUT_TOL) continue;
        cell[gridIndex(dims, iL, iA, iB)] = kept.length / 3;
        kept.push(L, a, b);
        lin.push(r, g, bl);
      }
    }
  }
  const n = kept.length / 3;
  const l = new Float32Array(n);
  const a = new Float32Array(n);
  const b = new Float32Array(n);
  const rgb = new Uint8Array(n * 3);
  const hue = new Float32Array(n);
  const chroma = new Float32Array(n);
  const neutral = step * 1e-3;
  for (let i = 0; i < n; i++) {
    l[i] = kept[3 * i];
    a[i] = kept[3 * i + 1];
    b[i] = kept[3 * i + 2];
    for (let k = 0; k < 3; k++) rgb[3 * i + k] = linearToSrgb8(lin[3 * i + k]);
    const c = Math.hypot(a[i], b[i]);
    chroma[i] = c;
    hue[i] = c > neutral ? (((Math.atan2(b[i], a[i]) * 180) / Math.PI) % 360 + 360) % 360 : NaN;
  }
  // A stable random permutation (Fisher–Yates), inverted into ranks.
  const order = Int32Array.from({ length: n }, (_, i) => i);
  const random = prng(0);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const rank = new Int32Array(n);
  for (let i = 0; i < n; i++) rank[order[i]] = i;
  return { space, n, l, a, b, rgb, hue, chroma, rank, dims, cell };
}

const cache = new Map<string, Lattice>();
/** The lattice for a space, built on first use. */
export function latticeFor(space: GamutSpace): Lattice {
  let hit = cache.get(space.id);
  if (!hit) cache.set(space.id, (hit = buildLattice(space)));
  return hit;
}
