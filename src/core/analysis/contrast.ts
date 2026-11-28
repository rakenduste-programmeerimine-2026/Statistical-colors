// WCAG 2 contrast between the largest clusters (#34, #64). Whether two
// colours are actually next to each other is not known from colours alone.
import { srgb8ToLinear, type Rgb8 } from "../color/oklch";
import type { ContrastPair, Finding, Meta, PaletteCluster } from "./color-analysis";

/** Up to this many of the largest clusters are paired. */
export const CONTRAST_MAX_CLUSTERS = 6;
/** Clusters under this share (%) are not paired. */
export const CONTRAST_MIN_SHARE = 1;

/** WCAG 2 relative luminance of an 8-bit sRGB colour. */
export const relativeLuminance = ({ r, g, b }: Rgb8) => 0.2126 * srgb8ToLinear(r) + 0.7152 * srgb8ToLinear(g) + 0.0722 * srgb8ToLinear(b);

/** WCAG 2 contrast ratio, 1–21. */
export function contrastRatio(a: Rgb8, b: Rgb8): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return Math.min(21, (hi + 0.05) / (lo + 0.05));
}

export const passesFor = (ratio: number): ContrastPair["passes"] => ({
  aaText: ratio >= 4.5,
  aaLargeText: ratio >= 3,
  aaNonText: ratio >= 3,
  aaaText: ratio >= 7,
});

const META: Meta = {
  provenance: "measured",
  confidence: 1,
  method: `WCAG 2 relative luminance of each cluster's most frequent colour; the ${CONTRAST_MAX_CLUSTERS} largest clusters with ≥ ${CONTRAST_MIN_SHARE} % share`,
  requires: "pixels",
  caveats: ["consistent-not-proven"],
};

/** Every pair of the largest clusters; the lighter colour is the foreground. */
export function contrastPairs(palette: readonly PaletteCluster[]): ContrastPair[] {
  const big = [...palette]
    .filter((p) => p.share >= CONTRAST_MIN_SHARE && p.representativeRgb)
    .sort((x, y) => y.share - x.share)
    .slice(0, CONTRAST_MAX_CLUSTERS);
  const pairs: ContrastPair[] = [];
  for (let i = 0; i < big.length; i++)
    for (let j = i + 1; j < big.length; j++) {
      const [a, b] = [big[i], big[j]];
      const [fg, bg] = relativeLuminance(a.representativeRgb!) >= relativeLuminance(b.representativeRgb!) ? [a, b] : [b, a];
      const ratio = contrastRatio(fg.representativeRgb!, bg.representativeRgb!);
      pairs.push({ fgClusterId: fg.id, bgClusterId: bg.id, ratio, passes: passesFor(ratio), meta: META });
    }
  return pairs;
}

const round2 = (x: number) => Math.round(x * 100) / 100;

/**
 * One finding for the palette as a whole: two similar tones are normal design,
 * so the severity follows the best pair, not the worst.
 */
export function contrastFinding(pairs: readonly ContrastPair[], palette: readonly PaletteCluster[]): Finding | undefined {
  if (!pairs.length) return undefined;
  const best = pairs.reduce((m, p) => (p.ratio > m.ratio ? p : m));
  const worst = pairs.reduce((m, p) => (p.ratio < m.ratio ? p : m));
  const aa = pairs.filter((p) => p.passes.aaText).length;
  const large = pairs.filter((p) => p.passes.aaLargeText).length;
  const severity: Finding["severity"] = aa > 0 ? "info" : large > 0 ? "notice" : "warning";
  const byId = new Map(palette.map((p) => [p.id, p]));
  const fg = byId.get(best.fgClusterId)!;
  const bg = byId.get(best.bgClusterId)!;
  return {
    id: "f-contrast",
    kind: "accessibility.contrast",
    area: "accessibility",
    severity,
    title: "Kontrast",
    detail:
      (aa > 0
        ? "Vähemalt üks paar ulatub tavateksti piirini 4,5 : 1."
        : large > 0
          ? "Ükski paar ei ulatu tavateksti piirini 4,5 : 1, kuid mõni ulatub suure teksti piirini 3 : 1."
          : "Ükski paar ei ulatu isegi suure teksti piirini 3 : 1.") +
      " Kas need värvid on pildil kõrvuti, pole värvide põhjal teada.",
    metrics: [
      { key: "maxRatio", label: "Kõrgeim kontrastsuhe", value: round2(best.ratio), unit: ": 1", min: 1, max: 21 },
      { key: "minRatio", label: "Madalaim kontrastsuhe", value: round2(worst.ratio), unit: ": 1", min: 1, max: 21 },
      { key: "pairsAa", label: "Paare ≥ 4,5 : 1", value: aa, unit: `/ ${pairs.length}` },
      { key: "pairsLarge", label: "Paare ≥ 3 : 1", value: large, unit: `/ ${pairs.length}` },
    ],
    swatches: [
      { color: fg.color, label: "heledam", share: fg.share },
      { color: bg.color, label: "tumedam", share: bg.share },
    ],
    clusterIds: [fg.id, bg.id],
    meta: META,
  };
}
