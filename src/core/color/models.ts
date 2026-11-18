// Where a colour sits on the hue wheels of other colour models, for the
// structure wheel's alternative views (P-031 item 4). Only hue placement is
// needed; the wheel's own colours are always drawn in OKLCH.
import type { Rgb8 } from "./oklch";

export type ColorModel = "oklch" | "hsl" | "hsv" | "hwb" | "ryb";

/** Hue 0–360 (null for greys), saturation and lightness or value 0–1. */
export interface ModelColor {
  h: number | null;
  s: number;
  /** HSL lightness, HSV value or HWB whiteness, depending on the model. */
  l: number;
}

function hueOf(r: number, g: number, b: number): number | null {
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  if (d === 0) return null;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

export function toHsl({ r, g, b }: Rgb8): ModelColor {
  const [R, G, B] = [r / 255, g / 255, b / 255];
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const l = (max + min) / 2;
  const d = max - min;
  return { h: hueOf(R, G, B), s: d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1)), l };
}

export function toHsv({ r, g, b }: Rgb8): ModelColor {
  const [R, G, B] = [r / 255, g / 255, b / 255];
  const max = Math.max(R, G, B);
  const d = max - Math.min(R, G, B);
  return { h: hueOf(R, G, B), s: max === 0 ? 0 : d / max, l: max };
}

/** HWB shares the HSV hue; `s` holds blackness and `l` whiteness. */
export function toHwb({ r, g, b }: Rgb8): ModelColor {
  const [R, G, B] = [r / 255, g / 255, b / 255];
  return { h: hueOf(R, G, B), s: 1 - Math.max(R, G, B), l: Math.min(R, G, B) };
}

/**
 * The artist's red–yellow–blue wheel (Itten), as a piecewise-linear map from
 * the HSV hue: red 0, orange 60, yellow 120, green 180, blue 240, violet 300.
 * [UNDERSTANDING] There is no single standard RYB; these anchors are the common one.
 */
const HSV_TO_RYB: readonly [number, number][] = [
  [0, 0],
  [30, 60],
  [60, 120],
  [120, 180],
  [240, 240],
  [270, 300],
  [360, 360],
];
export function hsvHueToRyb(h: number): number {
  for (let i = 1; i < HSV_TO_RYB.length; i++) {
    const [a0, b0] = HSV_TO_RYB[i - 1];
    const [a1, b1] = HSV_TO_RYB[i];
    if (h <= a1) return b0 + ((h - a0) / (a1 - a0)) * (b1 - b0);
  }
  return h;
}
export function rybHueToHsv(h: number): number {
  for (let i = 1; i < HSV_TO_RYB.length; i++) {
    const [a0, b0] = HSV_TO_RYB[i - 1];
    const [a1, b1] = HSV_TO_RYB[i];
    if (h <= b1) return a0 + ((h - b0) / (b1 - b0)) * (a1 - a0);
  }
  return h;
}

/** The hue a colour has on the given model's wheel (null for greys). */
export function modelHue(model: Exclude<ColorModel, "oklch">, color: Rgb8): number | null {
  if (model === "hsl") return toHsl(color).h;
  if (model === "hsv") return toHsv(color).h;
  if (model === "hwb") return toHwb(color).h;
  const h = toHsv(color).h;
  return h === null ? null : hsvHueToRyb(h);
}

/** The colour shown at hue `h` on a model's wheel, at full saturation, as 8-bit sRGB. */
export function wheelColor(model: Exclude<ColorModel, "oklch">, h: number): Rgb8 {
  const hsvHue = model === "ryb" ? rybHueToHsv(h) : h;
  const f = (n: number) => {
    const k = (n + hsvHue / 60) % 6;
    return Math.round(255 * (1 - Math.max(0, Math.min(k, 4 - k, 1))));
  };
  return { r: f(5), g: f(3), b: f(1) };
}
