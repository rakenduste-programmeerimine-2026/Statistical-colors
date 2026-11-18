// ⚠ UNVERIFIED PROTOTYPE, shared for the backend team (P-031 item 10).
// Written by Claude as an experiment; not part of the app, not built, not tested in CI.
// Please verify it and write your own tests before integrating anything into backend
// code. Results and limits: prototypes/colour-analysis/README.md.

// E3b: fixes found on the real demo palette. Harmonies are fitted on the top-k
// chromatic clusters by share, and ramps must have steps of at least minStep ΔE.
// Run: node claude-setup/experiments/E3b-demo-subsets.mts
import { readFileSync } from "node:fs";
import { cluster, findRamps, fitHarmonies, rgbToLab } from "./E3-E8-structures.mts";

const demo = JSON.parse(readFileSync("src/adapters/demo/palette-analysis.json", "utf8")) as { colors: { r: number; g: number; b: number; percent: number }[] };
const cs = cluster(demo.colors.map((c) => ({ lab: rgbToLab(c.r, c.g, c.b), w: c.percent / 100 })), 0.02);
const chroma = cs.filter((c) => c.lch.C >= 0.04).sort((a, b) => b.w - a.w);
console.log(`top chromatic clusters by share: ${chroma.slice(0, 8).map((c) => `${c.id}(h ${c.lch.h.toFixed(0)}, ${(c.w * 100).toFixed(2)}%)`).join(" ")}`);
for (const k of [2, 3, 4, 6, 8]) {
  const fits = fitHarmonies(chroma.slice(0, k));
  console.log(`top ${k}: ${fits.length ? fits.slice(0, 2).map((f) => `${f.code} rot ${f.rotation} maxErr ${f.maxErr.toFixed(1)}°`).join("; ") : "no harmony within 15°"}`);
}
const ramps = findRamps(cs).filter((r) => r.meanStep >= 0.03);
console.log(`ramps with mean step ≥ 0.03: ${ramps.length ? ramps.map((r) => `${r.code} ${r.ids.length} pts step ${r.meanStep.toFixed(3)}`).join("; ") : "none"}`);
const hueSpread = chroma.map((c) => c.lch.h).sort((a, b) => a - b);
console.log(`chromatic hue range ${hueSpread[0].toFixed(0)}°..${hueSpread[hueSpread.length - 1].toFixed(0)}°, L range ${Math.min(...cs.map((c) => c.lch.L)).toFixed(2)}..${Math.max(...cs.map((c) => c.lch.L)).toFixed(2)}`);
