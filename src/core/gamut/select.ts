// The hue and chroma range selection of the notebook's cell 19, unchanged in
// behaviour (P-035 step 1): a hue window around a centre, a chroma range, and
// whether neutrals (no hue) count as selected.
import type { Lattice } from "./lattice";

/** The notebook's caps on drawn points (cell 19). */
export const BACKGROUND_MAX_POINTS = 15000;
/** Raised from the notebook's 12,000 so all 13,000 CIELAB dots draw when everything is selected (P-039 item 1). */
export const SELECTED_MAX_POINTS = 15000;

export interface GamutSelection {
  hueCenter: number;
  hueWidth: number;
  chromaMin: number;
  chromaMax: number;
  includeNeutrals: boolean;
  /** Lightness range in the space's own units (P-039 item 1); absent means all. */
  lightMin?: number;
  lightMax?: number;
}

export const angularDistance = (x: number, y: number) => {
  const d = Math.abs(x - y) % 360;
  return Math.min(d, 360 - d);
};

/** Whether one point's hue lies in the window (cell 19, hue_window_mask). */
export function inHueWindow(hue: number, center: number, width: number, includeNeutrals: boolean): boolean {
  const w = Math.min(360, Math.max(0, width));
  if (Number.isNaN(hue)) return includeNeutrals;
  if (w >= 360) return true;
  return angularDistance(hue, center) <= w / 2;
}

export interface SelectionResult {
  /** 1 where the point is selected. */
  selected: Uint8Array;
  selectedCount: number;
  neutralCount: number;
  /** Indices to draw, capped like the notebook, in stable random order. */
  foreground: Int32Array;
  background: Int32Array;
}

/** Up to `max` indices of the mask, chosen by lowest rank (cell 19, sample_mask_indices). */
export function sampleIndices(mask: Uint8Array, want: 0 | 1, rank: Int32Array, max: number): Int32Array {
  const idx: number[] = [];
  for (let i = 0; i < mask.length; i++) if (mask[i] === want) idx.push(i);
  if (idx.length <= max) return Int32Array.from(idx);
  idx.sort((x, y) => rank[x] - rank[y]);
  return Int32Array.from(idx.slice(0, max));
}

/** Null when the chroma range is invalid (minimum above maximum), as the notebook refuses it. */
export function selectLattice(lattice: Lattice, s: GamutSelection): SelectionResult | null {
  if (s.chromaMin > s.chromaMax) return null;
  if (s.lightMin !== undefined && s.lightMax !== undefined && s.lightMin > s.lightMax) return null;
  const lMin = s.lightMin ?? -Infinity;
  const lMax = s.lightMax ?? Infinity;
  const selected = new Uint8Array(lattice.n);
  let selectedCount = 0;
  let neutralCount = 0;
  for (let i = 0; i < lattice.n; i++) {
    const h = lattice.hue[i];
    if (Number.isNaN(h)) neutralCount++;
    const c = lattice.chroma[i];
    const l = lattice.l[i];
    if (inHueWindow(h, s.hueCenter, s.hueWidth, s.includeNeutrals) && c >= s.chromaMin && c <= s.chromaMax && l >= lMin && l <= lMax) {
      selected[i] = 1;
      selectedCount++;
    }
  }
  return {
    selected,
    selectedCount,
    neutralCount,
    foreground: sampleIndices(selected, 1, lattice.rank, SELECTED_MAX_POINTS),
    background: sampleIndices(selected, 0, lattice.rank, BACKGROUND_MAX_POINTS),
  };
}
