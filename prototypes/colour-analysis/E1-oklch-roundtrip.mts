// ⚠ UNVERIFIED PROTOTYPE, shared for the backend team (P-031 item 10).
// Written by Claude as an experiment; not part of the app, not built, not tested in CI.
// Please verify it and write your own tests before integrating anything into backend
// code. Results and limits: prototypes/colour-analysis/README.md.

// E1: does `oklch(L% C h)` text with 2/5/2 decimals round-trip every 8-bit sRGB
// colour, with the CSS Color 4 matrices browsers use? Plus E7: hue error for a
// one-step change in an 8-bit channel, as a function of chroma (gives c0).
// Run: node prototypes/colour-analysis/E1-oklch-roundtrip.mts

const toLin = (v: number) => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const fromLin = (c: number) => 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

// CSS Color 4 (linear sRGB → LMS → OKLab), as in the spec's sample code.
const M1 = [
  [0.4122214694707629, 0.5363325372617349, 0.0514459932675022],
  [0.2119034958178251, 0.6806995506452344, 0.1073969535369406],
  [0.0883097947335500, 0.2817188386871742, 0.6299787005613017],
];
const M2 = [
  [0.2104542683093140, 0.7936177747023054, -0.0040720430116193],
  [1.9779985324311684, -2.4285922420485799, 0.4505937096174110],
  [0.0259040424655478, 0.7827717124575296, -0.8086757549230774],
];
const M2inv = [
  [1, 0.3963377773761749, 0.2158037573099136],
  [1, -0.1055613458156586, -0.0638541728258133],
  [1, -0.0894841775298119, -1.2914855480194092],
];
const M1inv = [
  [4.0767416360759583, -3.3077115392580629, 0.2309699031821043],
  [-1.2684379732850315, 2.6097573492876882, -0.3413193760026573],
  [-0.0041960761386756, -0.7034186179359363, 1.7076146940746117],
];
const mul = (m: number[][], v: number[]) => m.map((r) => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]);

function toOklch(r: number, g: number, b: number) {
  const lms = mul(M1, [toLin(r), toLin(g), toLin(b)]).map(Math.cbrt);
  const [L, a, bb] = mul(M2, lms);
  const C = Math.hypot(a, bb);
  let h = (Math.atan2(bb, a) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { L, C, h };
}
function fromOklch(L: number, C: number, h: number) {
  const hr = (h * Math.PI) / 180;
  const lms = mul(M2inv, [L, C * Math.cos(hr), C * Math.sin(hr)]).map((x) => x ** 3);
  return mul(M1inv, lms).map((c) => Math.round(fromLin(c)));
}

// Text form: L as % with 2 decimals, C with 5, h with 2; hue "none" when C prints as 0.
function roundTrip(r: number, g: number, b: number) {
  const { L, C, h } = toOklch(r, g, b);
  const Ls = Number((L * 100).toFixed(2)) / 100;
  const Cs = Number(C.toFixed(5));
  const hs = Cs === 0 ? 0 : Number(h.toFixed(2)) % 360;
  return fromOklch(Ls, Cs, hs);
}

let bad = 0;
const t0 = Date.now();
for (let r = 0; r < 256; r++)
  for (let g = 0; g < 256; g++)
    for (let b = 0; b < 256; b++) {
      const [R, G, B] = roundTrip(r, g, b);
      if (R !== r || G !== g || B !== b) bad++;
    }
console.log(`E1: 2/5/2 decimals, CSS Color 4 matrices: ${bad} of 16777216 colours do not round-trip (${Date.now() - t0} ms)`);

for (const [name, rgb] of [["#FF0000", [255, 0, 0]], ["#032F29", [3, 47, 41]], ["#0A141E", [10, 20, 30]], ["#808080", [128, 128, 128]], ["#FFFFFF", [255, 255, 255]]] as const) {
  const o = toOklch(...(rgb as [number, number, number]));
  console.log(`  ${name} → oklch(${(o.L * 100).toFixed(2)}% ${o.C.toFixed(5)} ${Number(o.C.toFixed(5)) === 0 ? "none" : o.h.toFixed(2)})`);
}

// E7: worst hue change for a ±1 step in any channel, binned by chroma.
const bins = [0.005, 0.01, 0.02, 0.03, 0.04, 0.06, 0.08, 0.12, 0.2, 0.4];
const worst = new Array(bins.length).fill(0);
const d = (a: number, b: number) => {
  const x = Math.abs(a - b) % 360;
  return Math.min(x, 360 - x);
};
for (let i = 0; i < 400000; i++) {
  const c = [0, 1, 2].map(() => 1 + Math.floor(Math.random() * 254));
  const o = toOklch(c[0], c[1], c[2]);
  const k = bins.findIndex((x) => o.C < x);
  if (k < 0) continue;
  for (const ch of [0, 1, 2]) for (const s of [-1, 1]) {
    const n = [...c];
    n[ch] += s;
    worst[k] = Math.max(worst[k], d(o.h, toOklch(n[0], n[1], n[2]).h));
  }
}
console.log("E7: worst hue change (°) for a ±1 channel step, by chroma upper bound:");
bins.forEach((b, i) => console.log(`  C < ${b}: ${worst[i].toFixed(1)}°`));
