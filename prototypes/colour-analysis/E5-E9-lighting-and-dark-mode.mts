// ⚠ UNVERIFIED PROTOTYPE, shared for the backend team (P-031 item 10).
// Written by Claude as an experiment; not part of the app, not built, not tested in CI.
// Please verify it and write your own tests before integrating anything into backend
// code. Results and limits: prototypes/colour-analysis/README.md.

// E5: teal–orange grading vs an orange object under neutral light, from pixel
// statistics only (hue by lightness band). E9: dark vs light UI from pixel
// statistics (a dominant flat background and small high-contrast text clusters).
// Synthetic pixels in OKLCH; no images needed. Run: node prototypes/colour-analysis/E5-E9-lighting-and-dark-mode.mts
type Px = { L: number; C: number; h: number };
let seed = 11;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
const circMean = (px: Px[]) => {
  let x = 0, y = 0, w = 0;
  for (const p of px) {
    x += p.C * Math.cos((p.h * Math.PI) / 180);
    y += p.C * Math.sin((p.h * Math.PI) / 180);
    w += 1;
  }
  return { h: ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360, C: Math.hypot(x, y) / w };
};
const inBand = (h: number, lo: number, hi: number) => h >= lo && h <= hi;

/** E5 rule: shadows lean teal and highlights lean orange, each with a mean chroma offset ≥ cMin. */
function tealOrange(px: Px[], cMin = 0.02) {
  const shadows = circMean(px.filter((p) => p.L < 0.4));
  const highs = circMean(px.filter((p) => p.L > 0.65));
  const hit = inBand(shadows.h, 170, 240) && shadows.C >= cMin && inBand(highs.h, 35, 85) && highs.C >= cMin;
  return { hit, shadows, highs };
}
const scene = (shadowTint: Px | null, highlightTint: Px | null, objects: Px[]) => {
  const px: Px[] = [];
  for (let i = 0; i < 20000; i++) {
    const L = Math.min(0.98, Math.max(0.03, rnd()));
    // Neutral world with small random chroma, plus a share of coloured objects.
    let a = gauss() * 0.01, b = gauss() * 0.01;
    if (rnd() < 0.15) {
      const o = objects[Math.floor(rnd() * objects.length)];
      a += o.C * Math.cos((o.h * Math.PI) / 180);
      b += o.C * Math.sin((o.h * Math.PI) / 180);
    }
    const tint = L < 0.4 ? shadowTint : L > 0.65 ? highlightTint : null;
    if (tint) {
      const k = L < 0.4 ? (0.4 - L) / 0.4 : (L - 0.65) / 0.35;
      a += k * tint.C * Math.cos((tint.h * Math.PI) / 180);
      b += k * tint.C * Math.sin((tint.h * Math.PI) / 180);
    }
    px.push({ L, C: Math.hypot(a, b), h: ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360 });
  }
  return px;
};
const teal = { L: 0, C: 0.06, h: 205 };
const orange = { L: 0, C: 0.06, h: 60 };
const objs = [{ L: 0, C: 0.12, h: 140 }, { L: 0, C: 0.12, h: 300 }, { L: 0, C: 0.12, h: 25 }];
for (const [name, px] of [
  ["graded teal–orange", scene(teal, orange, objs)],
  ["neutral light, orange objects only", scene(null, null, [{ L: 0, C: 0.14, h: 60 }])],
  ["warm cast only (no teal shadows)", scene(null, orange, objs)],
  ["teal–orange, weak (C 0.02)", scene({ ...teal, C: 0.025 }, { ...orange, C: 0.025 }, objs)],
] as const) {
  const r = tealOrange(px as Px[]);
  console.log(`E5 ${name}: ${r.hit ? "TEAL–ORANGE" : "no"} (shadows h ${r.shadows.h.toFixed(0)} C ${r.shadows.C.toFixed(3)}, highlights h ${r.highs.h.toFixed(0)} C ${r.highs.C.toFixed(3)})`);
}

/** E9 rule: the largest flat cluster (a background) covers ≥ 35 %, with dark L ≤ 0.3 and text clusters at L ≥ 0.7 covering ≥ 1 %; mirrored for light. */
function uiMode(clusters: { L: number; share: number }[]) {
  const bg = [...clusters].sort((a, b) => b.share - a.share)[0];
  if (!bg || bg.share < 0.35) return "undetermined (no dominant flat background)";
  const contrastShare = clusters.filter((c) => c !== bg && Math.abs(c.L - bg.L) >= 0.4).reduce((s, c) => s + c.share, 0);
  if (contrastShare < 0.01) return "undetermined (no contrasting text)";
  if (bg.L <= 0.3) return `dark UI (background L ${bg.L}, ${(bg.share * 100).toFixed(0)} %)`;
  if (bg.L >= 0.85) return `light UI (background L ${bg.L}, ${(bg.share * 100).toFixed(0)} %)`;
  return `mid-tone background (L ${bg.L}): neither`;
}
for (const [name, cs] of [
  ["dark dashboard", [{ L: 0.18, share: 0.62 }, { L: 0.24, share: 0.2 }, { L: 0.92, share: 0.05 }, { L: 0.7, share: 0.03 }, { L: 0.6, share: 0.1 }]],
  ["light docs page", [{ L: 0.99, share: 0.7 }, { L: 0.2, share: 0.06 }, { L: 0.55, share: 0.24 }]],
  ["photo (no flat background)", [{ L: 0.3, share: 0.12 }, { L: 0.5, share: 0.1 }, { L: 0.7, share: 0.08 }, { L: 0.4, share: 0.11 }]],
  ["dark image without text", [{ L: 0.15, share: 0.9 }, { L: 0.2, share: 0.1 }]],
  ["grey app", [{ L: 0.6, share: 0.6 }, { L: 0.1, share: 0.05 }, { L: 0.65, share: 0.35 }]],
] as const) console.log(`E9 ${name}: ${uiMode(cs as unknown as { L: number; share: number }[])}`);
