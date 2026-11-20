// Palette types from which clusters are chromatic (#59, docs/ontology/README.md):
// achromatic (all C < c₀) and neutral plus one accent hue.
import { deltaEOk, type Oklch } from "../color/oklch";
import type { ColorStructure, PaletteCluster, StructurePoint } from "./color-analysis";
import { HARMONY_C0 } from "./harmonies";

/** Chromatic clusters within this hue distance (degrees) of the largest one count as one accent. */
export const ACCENT_MAX_HUE_SPREAD = 15;
/** The neutral clusters must cover at least this share (%) for "neutral plus accent". */
export const NEUTRAL_MIN_SHARE = 50;

const hueDist = (a: number, b: number) => {
  const x = (((a - b) % 360) + 360) % 360;
  return Math.min(x, 360 - x);
};
const isChromatic = (c: PaletteCluster) => c.color.h !== null && c.color.c >= HARMONY_C0;

/** A neutral's ideal is the grey of its lightness, so ΔE is its chroma; an accent's ideal is itself. */
function point(c: PaletteCluster, neutral: boolean): StructurePoint {
  const ideal: Oklch = neutral ? { l: c.color.l, c: 0, h: null } : c.color;
  return { clusterId: c.id, ideal, actual: c.color, deltaE: deltaEOk(ideal, c.color) };
}

function structure(id: string, code: string, title: string, laws: ColorStructure["laws"], points: StructurePoint[], method: string): ColorStructure {
  return {
    id,
    code,
    family: "palette",
    title,
    model: "oklch",
    laws,
    points,
    coverage: 1,
    score: 1,
    residual: points.reduce((s, p) => s + p.deltaE, 0) / points.length,
    meta: { provenance: "measured", confidence: 1, method, requires: "pixels", caveats: ["consistent-not-proven"] },
  };
}

export function paletteTypes(palette: readonly PaletteCluster[]): ColorStructure[] {
  if (!palette.length) return [];
  const chroma = palette.filter(isChromatic);
  const neutrals = palette.filter((c) => !isChromatic(c));
  if (!chroma.length) {
    return [structure("s-achromatic", "palette.achromatic", "Akromaatne", { l: "free", c: "const", h: "free" }, neutrals.map((c) => point(c, true)), `every cluster has C < ${HARMONY_C0}`)];
  }
  const accent = chroma.reduce((m, c) => (c.share > m.share ? c : m));
  const oneHue = chroma.every((c) => hueDist(c.color.h!, accent.color.h!) <= ACCENT_MAX_HUE_SPREAD);
  const neutralShare = neutrals.reduce((s, c) => s + c.share, 0);
  if (!oneHue || neutralShare < NEUTRAL_MIN_SHARE || !neutrals.length) return [];
  return [
    structure(
      "s-neutral-plus-accent",
      "palette.neutral-plus-accent",
      "Neutraalne ja üks aktsentvärv",
      { l: "free", c: "two-level", h: "const" },
      [...neutrals.map((c) => point(c, true)), ...chroma.map((c) => point(c, false))],
      `chromatic clusters (C ≥ ${HARMONY_C0}) within ${ACCENT_MAX_HUE_SPREAD}° of the largest one; neutrals cover ≥ ${NEUTRAL_MIN_SHARE} %`,
    ),
  ];
}
