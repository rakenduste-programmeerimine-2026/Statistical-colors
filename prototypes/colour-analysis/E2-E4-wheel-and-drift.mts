// ⚠ UNVERIFIED PROTOTYPE, shared for the backend team (P-031 item 10).
// Written by Claude as an experiment; not part of the app, not built, not tested in CI.
// Please verify it and write your own tests before integrating anything into backend
// code. Results and limits: prototypes/colour-analysis/README.md.

// E2: the largest constant chroma that stays inside sRGB for every hue, per
// lightness (for drawing the OKLCH hue ring). E4: harmonies built in HSL, HSV
// and RYB, measured in OKLCH (how far each spoke drifts from the ideal).
// Run: node claude-setup/experiments/E2-E4-wheel-and-drift.mts

const toLin = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const fromLin = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
const mul = (m: number[][], v: number[]) => m.map((r) => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]);
const M1 = [[0.4122214694707629, 0.5363325372617349, 0.0514459932675022], [0.2119034958178251, 0.6806995506452344, 0.1073969535369406], [0.08830979473355, 0.2817188386871742, 0.6299787005613017]];
const M2 = [[0.210454268309314, 0.7936177747023054, -0.0040720430116193], [1.9779985324311684, -2.4285922420485799, 0.450593709617411], [0.0259040424655478, 0.7827717124575296, -0.8086757549230774]];
const M2inv = [[1, 0.3963377773761749, 0.2158037573099136], [1, -0.1055613458156586, -0.0638541728258133], [1, -0.0894841775298119, -1.2914855480194092]];
const M1inv = [[4.0767416360759583, -3.3077115392580629, 0.2309699031821043], [-1.2684379732850315, 2.6097573492876882, -0.3413193760026573], [-0.0041960761386756, -0.7034186179359363, 1.7076146940746117]];

/** r, g, b in 0..1 → OKLCH. */
function oklch(r: number, g: number, b: number) {
  const [L, a, bb] = mul(M2, mul(M1, [toLin(r), toLin(g), toLin(b)]).map(Math.cbrt));
  return { L, C: Math.hypot(a, bb), h: ((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360 };
}
function inGamut(L: number, C: number, h: number) {
  const hr = (h * Math.PI) / 180;
  const lin = mul(M1inv, mul(M2inv, [L, C * Math.cos(hr), C * Math.sin(hr)]).map((x) => x ** 3));
  return lin.every((c) => c >= -1e-6 && c <= 1 + 1e-6);
}

// ---- E2
let best = { L: 0, C: 0 };
for (let L = 0.4; L <= 0.9; L += 0.01) {
  let C = 0;
  while ([...Array(360).keys()].every((h) => inGamut(L, C + 0.001, h))) C += 0.001;
  if (C > best.C) best = { L, C };
  if (Math.abs(L * 100 - Math.round(L * 100 / 5) * 5) < 1e-6) console.log(`E2: L ${L.toFixed(2)} → largest all-hue chroma ${C.toFixed(3)}`);
}
console.log(`E2: best ring: L ${best.L.toFixed(2)}, C ${best.C.toFixed(3)}`);

// ---- E4: hue models
const hsl2rgb = (h: number, s: number, l: number) => {
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [f(0), f(8), f(4)];
};
const hsv2rgb = (h: number, s: number, v: number) => {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return [f(5), f(3), f(1)];
};
// RYB (artist) wheel: piecewise-linear map from RYB hue to HSV hue, using the
// usual anchors red 0, orange 30, yellow 60, green 120, blue 240, violet 270.
const RYB_TO_HSV: [number, number][] = [[0, 0], [60, 30], [120, 60], [180, 120], [240, 240], [300, 270], [360, 360]];
const rybToHsvHue = (h: number) => {
  for (let i = 1; i < RYB_TO_HSV.length; i++) {
    const [a0, b0] = RYB_TO_HSV[i - 1];
    const [a1, b1] = RYB_TO_HSV[i];
    if (h <= a1) return b0 + ((h - a0) / (a1 - a0)) * (b1 - b0);
  }
  return h;
};
const d = (a: number, b: number) => {
  const x = Math.abs(a - b) % 360;
  return Math.min(x, 360 - x);
};
const templates: Record<string, number[]> = {
  complementary: [0, 180],
  triadic: [0, 120, 240],
  "split-complementary": [0, 150, 210],
  square: [0, 90, 180, 270],
  analogous: [-30, 0, 30],
};

for (const [model, make] of [
  ["HSL s=1 l=0.5", (h: number) => hsl2rgb(h, 1, 0.5)],
  ["HSL s=0.6 l=0.6", (h: number) => hsl2rgb(h, 0.6, 0.6)],
  ["HSV s=1 v=1", (h: number) => hsv2rgb(h, 1, 1)],
  ["RYB (via HSV) s=1 v=1", (h: number) => hsv2rgb(rybToHsvHue(h), 1, 1)],
] as const) {
  const rows: string[] = [];
  for (const [name, offs] of Object.entries(templates)) {
    let worstGap = 0;
    // Built in the model from a few base hues; measured as OKLCH gaps against the same template.
    for (let base = 0; base < 360; base += 15) {
      const hues = offs.map((o) => oklch(...(make((base + o + 360) % 360) as [number, number, number])).h);
      // Ideal OKLCH rotation for these points: best mean error over all rotations.
      let bestErr = Infinity;
      for (let r = 0; r < 360; r += 0.5) {
        const err = Math.max(...hues.map((h, i) => d(h, r + offs[i])));
        bestErr = Math.min(bestErr, err);
      }
      worstGap = Math.max(worstGap, bestErr);
    }
    rows.push(`${name}: worst spoke error in OKLCH ${worstGap.toFixed(1)}°`);
  }
  console.log(`E4 ${model}:\n  ${rows.join("\n  ")}`);
}
// The concrete case from the plan: an HSL triad starting at red.
const tri = [0, 120, 240].map((h) => oklch(...(hsl2rgb(h, 1, 0.5) as [number, number, number])).h);
console.log(`E4: HSL triad from red lands at OKLCH hues ${tri.map((h) => h.toFixed(1)).join(", ")}; gaps ${[tri[1] - tri[0], tri[2] - tri[1], 360 - tri[2] + tri[0]].map((g) => g.toFixed(1)).join(", ")}`);
