// sRGB ↔ OKLab ↔ OKLCH, with the CSS Color 4 matrices browsers use (P-031 item 11).
// Everything is 8-bit sRGB in and out (P-011, P-031 item 6).

/** OKLCH: l 0–1, c ≥ 0, h in [0, 360) or null when achromatic; alpha 0–1. */
export interface Oklch {
  l: number;
  c: number;
  h: number | null;
  alpha?: number;
}

export interface Rgb8 {
  r: number;
  g: number;
  b: number;
  /** Alpha 0–255. */
  a?: number;
}

type Vec3 = [number, number, number];
const mul = (m: readonly Vec3[], v: Vec3): Vec3 => [
  m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
  m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
  m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
];

// Linear sRGB → LMS, LMS^(1/3) → OKLab, and their inverses (CSS Color 4, section 9.2).
const RGB_TO_LMS: readonly Vec3[] = [
  [0.4122214694707629, 0.5363325372617349, 0.0514459932675022],
  [0.2119034958178251, 0.6806995506452344, 0.1073969535369406],
  [0.08830979473355, 0.2817188386871742, 0.6299787005613017],
];
const LMS_TO_LAB: readonly Vec3[] = [
  [0.210454268309314, 0.7936177747023054, -0.0040720430116193],
  [1.9779985324311684, -2.4285922420485799, 0.450593709617411],
  [0.0259040424655478, 0.7827717124575296, -0.8086757549230774],
];
const LAB_TO_LMS: readonly Vec3[] = [
  [1, 0.3963377773761749, 0.2158037573099136],
  [1, -0.1055613458156586, -0.0638541728258133],
  [1, -0.0894841775298119, -1.2914855480194092],
];
const LMS_TO_RGB: readonly Vec3[] = [
  [4.0767416360759583, -3.3077115392580629, 0.2309699031821043],
  [-1.2684379732850315, 2.6097573492876882, -0.3413193760026573],
  [-0.0041960761386756, -0.7034186179359363, 1.7076146940746117],
];

const toLinear = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const fromLinear = (v: number) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);

/** Chroma that prints as 0 at 5 decimals: the hue is meaningless and shown as `none`. */
const ACHROMATIC = 0.000005;

export function srgbToOklab({ r, g, b }: Rgb8): Vec3 {
  const lms = mul(RGB_TO_LMS, [toLinear(r / 255), toLinear(g / 255), toLinear(b / 255)]);
  return mul(LMS_TO_LAB, [Math.cbrt(lms[0]), Math.cbrt(lms[1]), Math.cbrt(lms[2])]);
}

export function srgbToOklch(color: Rgb8): Oklch {
  const [l, a, b] = srgbToOklab(color);
  const c = Math.hypot(a, b);
  const out: Oklch = c < ACHROMATIC ? { l, c: 0, h: null } : { l, c, h: ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360 };
  if (color.a !== undefined) out.alpha = color.a / 255;
  return out;
}

export function hexToOklch(hex: string): Oklch {
  const n = parseInt(hex.replace(/^#/, "").slice(0, 6), 16);
  return srgbToOklch({ r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 });
}

export function oklchToOklab({ l, c, h }: Oklch): Vec3 {
  const hr = ((h ?? 0) * Math.PI) / 180;
  return [l, c * Math.cos(hr), c * Math.sin(hr)];
}

/** Back to 8-bit sRGB; `inGamut` is false when a channel had to be clipped. */
export function oklchToSrgb(o: Oklch): { r: number; g: number; b: number; inGamut: boolean } {
  const lms = mul(LAB_TO_LMS, oklchToOklab(o)).map((x) => x ** 3) as Vec3;
  const lin = mul(LMS_TO_RGB, lms);
  const inGamut = lin.every((v) => v >= -1e-4 && v <= 1 + 1e-4);
  const [r, g, b] = lin.map((v) => Math.round(Math.min(1, Math.max(0, fromLinear(Math.min(1, Math.max(0, v))))) * 255));
  return { r, g, b, inGamut };
}

/** ΔE_OK: Euclidean distance in OKLab. Just-noticeable is about 0.02. */
export function deltaEOk(a: Oklch, b: Oklch): number {
  const p = oklchToOklab(a);
  const q = oklchToOklab(b);
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
}

/**
 * Lossless text form: L as a percentage with 2 decimals, C with 5, h with 2
 * (`none` when achromatic), and alpha with 3 when present. Every 8-bit sRGB
 * colour round-trips exactly at this precision (experiment E1, P-031 item 11).
 */
export function formatOklch(o: Oklch): string {
  const c = o.h === null ? "0" : o.c.toFixed(5);
  const h = o.h === null ? "none" : o.h.toFixed(2);
  const alpha = o.alpha !== undefined && o.alpha < 1 ? ` / ${Number(o.alpha.toFixed(3))}` : "";
  return `oklch(${(o.l * 100).toFixed(2)}% ${c} ${h}${alpha})`;
}

/** CSS colour for fills and swatches: the same precision as the text form. */
export const oklchCss = formatOklch;
