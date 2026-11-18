// ⚠ UNVERIFIED PROTOTYPE, shared for the backend team (P-031 item 10, P-036).
// Written by Claude as an experiment; not part of the app, not built, not tested in CI.
// Please verify it and write your own tests before integrating anything into backend
// code (#74). It imports the frontend's lattice and snapping so both give the same figure.
// Run: npx jiti prototypes/colour-analysis/E10-gamut-lattice.mts

import { buildLattice } from "../../src/core/gamut/lattice.ts";
import { CIELAB, OKLAB } from "../../src/core/gamut/space.ts";
import { snapColors, nearestPoint } from "../../src/core/gamut/snap.ts";
import { readFileSync } from "node:fs";

for (const space of [OKLAB, CIELAB]) {
  for (const step of space.id === "oklab" ? [0.02, 0.015, 0.013] : [4, 3.5, 3, 5]) {
    const s = { ...space, step };
    const t = performance.now();
    const lat = buildLattice(s);
    const ms = performance.now() - t;
    const neutrals = Array.from(lat.hue).filter(Number.isNaN).length;
    console.log(`${space.id} step ${step}: ${lat.n} points (${neutrals} neutral), grid ${lat.dims.join("×")}, ${ms.toFixed(1)} ms`);
  }
}
// Snap error: every 4-bit sRGB colour and every grey, distance to its lattice point in steps.
for (const space of [OKLAB, CIELAB]) {
  const lat = buildLattice(space);
  let worst = 0;
  let far = 0;
  const t = performance.now();
  for (let r = 0; r < 256; r += 17) for (let g = 0; g < 256; g += 17) for (let b = 0; b < 256; b += 17) {
    const [l, a, bb] = space.toCoords({ r, g, b });
    const k = nearestPoint(lat, l, a, bb);
    const d = Math.hypot(lat.l[k] - l, lat.a[k] - a, lat.b[k] - bb) / space.step;
    worst = Math.max(worst, d);
    if (d > Math.sqrt(3) / 2 + 1e-6) far++;
  }
  console.log(`${space.id}: worst snap ${worst.toFixed(3)} steps (√3/2 = 0.866), ${far} of 4096 beyond half a cell diagonal, ${(performance.now() - t).toFixed(1)} ms`);
}
// Coverage on the demo colours.
const demo = JSON.parse(readFileSync("src/adapters/demo/palette-analysis.json", "utf8"));
for (const space of [OKLAB, CIELAB]) {
  const lat = buildLattice(space);
  const snap = snapColors(lat, demo.colors);
  console.log(`${space.id}: demo ${demo.colors.length} colours → ${snap.occupied.length} of ${lat.n} points = ${((snap.occupied.length / lat.n) * 100).toFixed(2)} %; max share ${snap.maxShare.toFixed(2)} %`);
}
