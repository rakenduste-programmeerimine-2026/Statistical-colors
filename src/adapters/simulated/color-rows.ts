import type { ColorAnalysis } from "@/core/analysis/color-analysis";
import type { ColorArtefact, ColorCount } from "@/core/analysis/types";
import { deltaEOk, srgbToOklch } from "@/core/color/oklch";

// PLACEHOLDER(#69, #29, #63): the server sends each colour's artefact chance
// and cluster. Until then this simulates them, used by the stub and the demo,
// and the results page labels them as simulated (P-033 item 1). It never
// reads pixels; the colours and counts are left exactly as they were.

const OTHER_KINDS = ["artefact.chroma-subsampling", "artefact.jpeg-blocking", "artefact.banding"];

export function simulateColorRows(colors: ColorCount[], analysis: ColorAnalysis | undefined, random: () => number): ColorCount[] {
  if (colors.length === 0) return colors;
  const maxLog = Math.log10(colors[0].percent || 1e-9);
  const minLog = Math.log10(colors[colors.length - 1].percent || 1e-9);
  const span = maxLog - minLog || 1;
  return colors.map((c) => {
    // Rarer colours are more often blend pixels at edges.
    const rarity = (maxLog - Math.log10(c.percent || 1e-9)) / span;
    const artefacts: ColorArtefact[] = [
      { kind: "artefact.antialias-blend", chance: round(Math.min(1, Math.max(0, rarity * 0.9 + (random() - 0.5) * 0.3))) },
    ];
    if (random() < 0.08) artefacts.push({ kind: OTHER_KINDS[Math.floor(random() * OTHER_KINDS.length)], chance: round(random() * 0.6) });
    artefacts.sort((a, b) => b.chance - a.chance);
    const row: ColorCount = { ...c, artefacts };
    if (analysis?.palette.length) {
      const o = srgbToOklch(c);
      let best = analysis.palette[0];
      for (const p of analysis.palette) if (deltaEOk(o, p.color) < deltaEOk(o, best.color)) best = p;
      row.clusterId = best.id;
    }
    return row;
  });
}

const round = (x: number) => Math.round(x * 100) / 100;
