// The nearest colour name for any sRGB colour (P-038, P-039 item 8, P-040
// item 2): names from `color-name-list`, nearest by ΔE_OK (Euclidean distance
// in OKLab), found through a uniform grid so 5000 lookups stay cheap.
import { srgbToOklab, type Rgb8 } from "./oklch";

export interface NamedColor {
  name: string;
  hex: string;
}

/** Grid cell size in OKLab; about two just-noticeable differences. */
const CELL = 0.04;
const A_MIN = -0.45;
const B_MIN = -0.45;
const NL = Math.ceil(1.0001 / CELL) + 1;
const NA = Math.ceil(0.9 / CELL) + 1;
const NB = NA;

export interface NameIndex {
  names: string[];
  lab: Float32Array;
  /** Bucket start offsets per cell (length cells + 1) and the name indices in cell order. */
  start: Int32Array;
  items: Int32Array;
  exact: Map<number, number>;
  cache: Map<number, string>;
}

const clampI = (v: number, n: number) => Math.min(n - 1, Math.max(0, v));
const cellOf = (l: number, a: number, b: number): [number, number, number] => [
  clampI(Math.floor(l / CELL), NL),
  clampI(Math.floor((a - A_MIN) / CELL), NA),
  clampI(Math.floor((b - B_MIN) / CELL), NB),
];
const cellIndex = (i: number, j: number, k: number) => (i * NA + j) * NB + k;
const rgbKey = (c: Rgb8) => (c.r << 16) | (c.g << 8) | c.b;
const parseHex = (hex: string): Rgb8 => {
  const n = parseInt(hex.slice(1, 7), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
};

export function buildNameIndex(list: readonly NamedColor[]): NameIndex {
  const n = list.length;
  const names = list.map((c) => c.name);
  const lab = new Float32Array(n * 3);
  const cells = new Int32Array(n);
  const counts = new Int32Array(NL * NA * NB + 1);
  const exact = new Map<number, number>();
  list.forEach((c, i) => {
    const rgb = parseHex(c.hex);
    if (!exact.has(rgbKey(rgb))) exact.set(rgbKey(rgb), i);
    const [l, a, b] = srgbToOklab(rgb);
    lab.set([l, a, b], i * 3);
    const [ci, cj, ck] = cellOf(l, a, b);
    cells[i] = cellIndex(ci, cj, ck);
    counts[cells[i] + 1]++;
  });
  for (let i = 1; i < counts.length; i++) counts[i] += counts[i - 1];
  const fill = counts.slice();
  const items = new Int32Array(n);
  for (let i = 0; i < n; i++) items[fill[cells[i]]++] = i;
  return { names, lab, start: counts, items, exact, cache: new Map() };
}

/**
 * The nearest name by ΔE_OK. Searches growing cubes of cells around the
 * colour and stops only when no unsearched cell can hold anything nearer: after
 * ring r, every unsearched point is at least r·CELL away.
 */
export function nearestName(index: NameIndex, color: Rgb8): string {
  const key = rgbKey(color);
  const hit = index.cache.get(key);
  if (hit !== undefined) return hit;
  const exactHit = index.exact.get(key);
  if (exactHit !== undefined) {
    index.cache.set(key, index.names[exactHit]);
    return index.names[exactHit];
  }
  const [l, a, b] = srgbToOklab(color);
  const [ci, cj, ck] = cellOf(l, a, b);
  let best = -1;
  let bestD = Infinity;
  for (let r = 0; r < Math.max(NL, NA, NB); r++) {
    for (let i = ci - r; i <= ci + r; i++)
      for (let j = cj - r; j <= cj + r; j++)
        for (let k = ck - r; k <= ck + r; k++) {
          // Only the shell of this cube; the inside was searched in earlier rings.
          if (Math.max(Math.abs(i - ci), Math.abs(j - cj), Math.abs(k - ck)) !== r) continue;
          if (i < 0 || j < 0 || k < 0 || i >= NL || j >= NA || k >= NB) continue;
          const c = cellIndex(i, j, k);
          for (let p = index.start[c]; p < index.start[c + 1]; p++) {
            const m = index.items[p];
            const d = (index.lab[m * 3] - l) ** 2 + (index.lab[m * 3 + 1] - a) ** 2 + (index.lab[m * 3 + 2] - b) ** 2;
            if (d < bestD) {
              bestD = d;
              best = m;
            }
          }
        }
    if (best >= 0 && Math.sqrt(bestD) <= r * CELL) break;
  }
  const name = best >= 0 ? index.names[best] : "";
  index.cache.set(key, name);
  return name;
}

let loading: Promise<NameIndex> | undefined;
/** Loads the name list once, as its own chunk, only when a page needs names. */
export function loadNameIndex(): Promise<NameIndex> {
  loading ??= import("color-name-list").then((m) => buildNameIndex(m.colornames));
  return loading;
}
