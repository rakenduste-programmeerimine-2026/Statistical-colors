// Dark mode from the colour clusters (#60, experiment E9 plus a flatness
// test). Without layout or scene data it is a guess, so confidence stays 0.6.
import type { Finding, PaletteCluster } from "./color-analysis";

/** The background (the largest cluster) must cover at least this share (%). */
export const DARK_MIN_SHARE = 35;
/** …be at most this light (OKLCH L)… */
export const DARK_MAX_L = 0.3;
/** …and flat: its members at most this far apart (ΔE_OK). */
export const DARK_MAX_SPREAD = 0.01;
/** Content contrasts with the background by at least this much lightness… */
export const CONTENT_MIN_DELTA_L = 0.4;
/** …and covers at least this share (%) in total. */
export const CONTENT_MIN_SHARE = 1;
export const DARK_MODE_CONFIDENCE = 0.6;

/** A `ui.dark-mode` finding, or undefined when the rule does not hold. */
export function darkModeFinding(palette: readonly PaletteCluster[]): Finding | undefined {
  const bg = [...palette].sort((a, b) => b.share - a.share)[0];
  if (!bg || bg.share < DARK_MIN_SHARE || bg.color.l > DARK_MAX_L || bg.spreadDeltaE > DARK_MAX_SPREAD) return undefined;
  const content = palette.filter((c) => c !== bg && Math.abs(c.color.l - bg.color.l) >= CONTENT_MIN_DELTA_L);
  const contentShare = content.reduce((s, c) => s + c.share, 0);
  if (contentShare < CONTENT_MIN_SHARE) return undefined;
  const top = content.reduce((m, c) => (c.share > m.share ? c : m));
  const round = (x: number, d: number) => Number(x.toFixed(d));
  return {
    id: "f-dark-mode",
    kind: "ui.dark-mode",
    area: "ui",
    severity: "info",
    title: "Tume režiim",
    detail: "Suurim ühtlane värv on tume ja katab suure osa pildist; selle peal on heledat sisu. Ilma ekraanipildi tööriista andmeteta on see oletus.",
    metrics: [
      { key: "bgL", label: "Tausta heledus (L)", value: round(bg.color.l, 3), min: 0, max: 1 },
      { key: "bgShare", label: "Tausta osakaal", value: round(bg.share, 2), unit: "%", min: 0, max: 100 },
      { key: "contentShare", label: "Heleda sisu osakaal", value: round(contentShare, 2), unit: "%", min: 0, max: 100 },
    ],
    swatches: [
      { color: bg.color, label: "taust", share: bg.share },
      { color: top.color, label: "sisu", share: top.share },
    ],
    clusterIds: [bg.id, ...content.map((c) => c.id)],
    meta: {
      provenance: "inferred",
      confidence: DARK_MODE_CONFIDENCE,
      method: `largest cluster ≥ ${DARK_MIN_SHARE} % with L ≤ ${DARK_MAX_L} and spread ≤ ${DARK_MAX_SPREAD} ΔE; clusters ΔL ≥ ${CONTENT_MIN_DELTA_L} from it cover ≥ ${CONTENT_MIN_SHARE} %`,
      requires: "pixels",
      caveats: ["needs-scene-data"],
      references: ["ontology/05-ui-structure#dark-mode"],
    },
  };
}
