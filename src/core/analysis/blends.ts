// Antialias blend colours from the colour list alone (#29): a rare colour that
// lies between two real (frequent) colours in encoded 8-bit sRGB, where
// browsers and image tools blend edges. Pixel neighbours are not used.
import type { Finding } from "./color-analysis";
import type { ColorCount } from "./types";

export const BLEND_KIND = "artefact.antialias-blend";
/** Real colours (segment ends) have at least this share (%)… */
export const BLEND_ENDPOINT_MIN_SHARE = 1;
/** …and at most this many of the most frequent are used. */
export const BLEND_MAX_ENDPOINTS = 20;
/** Only colours under this share (%) can be blends. */
export const BLEND_MAX_SHARE = 1;
/** Largest distance from the segment, in 8-bit sRGB values (0–255 per channel). */
export const BLEND_MAX_DISTANCE = 6;
/** The colour must project between the ends, not next to one of them. */
export const BLEND_T_MIN = 0.1;
export const BLEND_T_MAX = 0.9;
/** At or above this chance a colour counts as a blend (the table's "tõenäoline"). */
export const BLEND_LIKELY = 0.5;

type Rgb = { r: number; g: number; b: number };

/** 1 − d / (2 · BLEND_MAX_DISTANCE) for the nearest segment it lies on, 0 when on none. */
export function blendChance(c: ColorCount, ends: readonly Rgb[]): number {
  if (c.percent >= BLEND_MAX_SHARE) return 0;
  let best = 0;
  for (let i = 0; i < ends.length; i++)
    for (let j = i + 1; j < ends.length; j++) {
      const [a, b] = [ends[i], ends[j]];
      const v = [b.r - a.r, b.g - a.g, b.b - a.b];
      const p = [c.r - a.r, c.g - a.g, c.b - a.b];
      const len2 = v[0] * v[0] + v[1] * v[1] + v[2] * v[2];
      if (!len2) continue;
      const t = (p[0] * v[0] + p[1] * v[1] + p[2] * v[2]) / len2;
      if (t < BLEND_T_MIN || t > BLEND_T_MAX) continue;
      const d = Math.hypot(p[0] - t * v[0], p[1] - t * v[1], p[2] - t * v[2]);
      if (d <= BLEND_MAX_DISTANCE) best = Math.max(best, 1 - d / (2 * BLEND_MAX_DISTANCE));
    }
  return Math.round(best * 1000) / 1000;
}

/** Every row with its blend chance (0 when it is not a blend). */
export function withBlendChances(colors: readonly ColorCount[]): ColorCount[] {
  const ends = [...colors]
    .filter((c) => c.percent >= BLEND_ENDPOINT_MIN_SHARE)
    .sort((x, y) => y.count - x.count)
    .slice(0, BLEND_MAX_ENDPOINTS);
  return colors.map((c) => ({ ...c, artefacts: [{ kind: BLEND_KIND, chance: blendChance(c, ends) }] }));
}

export const isBlend = (c: ColorCount) => (c.artefacts?.find((a) => a.kind === BLEND_KIND)?.chance ?? 0) >= BLEND_LIKELY;

/** One summary finding for the blend colours, or undefined when there are none. */
export function blendFinding(rows: readonly ColorCount[]): Finding | undefined {
  const blends = rows.filter(isBlend);
  if (!blends.length) return undefined;
  const share = blends.reduce((s, c) => s + c.percent, 0);
  return {
    id: "f-blend",
    kind: BLEND_KIND,
    area: "artefact",
    severity: "info",
    title: "Servade silumise vahevärvid",
    detail: "Harvad värvid, mis asuvad sRGB-s kahe sagedase värvi vahel. Need on tõenäoliselt servade silumisest tekkinud ja jäeti klasterdamisest välja.",
    metrics: [
      { key: "share", label: "Segupikslite osakaal", value: Math.round(share * 100) / 100, unit: "%", min: 0, max: 100 },
      { key: "colors", label: "Segupikslite värve", value: blends.length },
    ],
    meta: {
      provenance: "inferred",
      confidence: BLEND_LIKELY,
      method: `colours under ${BLEND_MAX_SHARE} % within ${BLEND_MAX_DISTANCE} sRGB values of a segment between two of the ${BLEND_MAX_ENDPOINTS} most frequent colours with ≥ ${BLEND_ENDPOINT_MIN_SHARE} %, t in [${BLEND_T_MIN}, ${BLEND_T_MAX}]`,
      requires: "pixels",
      caveats: ["consistent-not-proven", "antialias-blend"],
    },
  };
}
