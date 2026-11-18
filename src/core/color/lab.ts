// CIELAB (D50) ↔ sRGB, ported from the colour-space notebook's cell 19 (P-035):
// CIE Lab with the D50 white, Bradford D50 ↔ D65 adaptation, and the exact
// rational sRGB ↔ XYZ matrices. Used only by the 3D colour-space view; the
// analysis itself works in OKLab (P-011).
import { linearToSrgb8, srgb8ToLinear, type Rgb8, type Vec3 } from "./oklch";

const D50: Vec3 = [0.96422, 1.0, 0.82521];
const DELTA = 6 / 29;
const EPSILON = 216 / 24389;
const KAPPA = 24389 / 27;

const M_D50_TO_D65: readonly Vec3[] = [
  [0.955473421488075, -0.02309845494876471, 0.06325924320057072],
  [-0.0283697093338637, 1.0099953980813041, 0.021041441191917323],
  [0.012314014864481998, -0.020507649298898964, 1.330365926242124],
];
const M_D65_TO_D50: readonly Vec3[] = [
  [1.0479298208405488, 0.022946793341019088, -0.05019222954313557],
  [0.029627815688159344, 0.990434484573249, -0.01707382502938514],
  [-0.009243058152591178, 0.015055144896577895, 0.7518742899580008],
];
const M_XYZ_TO_LIN_SRGB: readonly Vec3[] = [
  [12831 / 3959, -329 / 214, -1974 / 3959],
  [-851781 / 878810, 1648619 / 878810, 36519 / 878810],
  [705 / 12673, -2585 / 12673, 705 / 667],
];
const M_LIN_SRGB_TO_XYZ: readonly Vec3[] = [
  [506752 / 1228815, 87881 / 245763, 12673 / 70218],
  [87098 / 409605, 175762 / 245763, 12673 / 175545],
  [7918 / 409605, 87881 / 737289, 1001167 / 1053270],
];

const mul = (m: readonly Vec3[], v: Vec3): Vec3 => [
  m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
  m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
  m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
];
const fInv = (t: number) => (t > DELTA ? t ** 3 : 3 * DELTA ** 2 * (t - 4 / 29));
const f = (t: number) => (t > EPSILON ? Math.cbrt(t) : (KAPPA * t + 16) / 116);

/** CIELAB (D50) to linear sRGB; channels outside 0–1 mean outside the gamut. */
export function labToLinearSrgb(L: number, a: number, b: number): Vec3 {
  const fy = (L + 16) / 116;
  const xyz50: Vec3 = [D50[0] * fInv(fy + a / 500), D50[1] * fInv(fy), D50[2] * fInv(fy - b / 200)];
  return mul(M_XYZ_TO_LIN_SRGB, mul(M_D50_TO_D65, xyz50));
}

/** 8-bit sRGB to CIELAB (D50): [L*, a*, b*]. */
export function srgbToLab({ r, g, b }: Rgb8): Vec3 {
  const xyz50 = mul(M_D65_TO_D50, mul(M_LIN_SRGB_TO_XYZ, [srgb8ToLinear(r), srgb8ToLinear(g), srgb8ToLinear(b)]));
  const fx = f(xyz50[0] / D50[0]);
  const fy = f(xyz50[1] / D50[1]);
  const fz = f(xyz50[2] / D50[2]);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** CIELAB (D50) back to 8-bit sRGB, clamped. */
export function labToSrgb(L: number, a: number, b: number): Rgb8 {
  const [r, g, bl] = labToLinearSrgb(L, a, b);
  return { r: linearToSrgb8(r), g: linearToSrgb8(g), b: linearToSrgb8(bl) };
}
