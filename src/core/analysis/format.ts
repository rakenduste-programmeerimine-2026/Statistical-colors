import type { ColorCount } from "./types";

const hex2 = (n: number) => n.toString(16).toUpperCase().padStart(2, "0");

/** `#RRGGBB`, or `#RRGGBB AAA` with alpha as a 3-digit decimal, as in the summary CSV. */
export function formatHex(color: Pick<ColorCount, "r" | "g" | "b" | "a">): string {
  const rgb = `#${hex2(color.r)}${hex2(color.g)}${hex2(color.b)}`;
  return color.a === undefined ? rgb : `${rgb} ${String(color.a).padStart(3, "0")}`;
}

/** `(r, g, b)` or `(r, g, b, a)`. */
export function formatTuple(color: Pick<ColorCount, "r" | "g" | "b" | "a">): string {
  const parts = [color.r, color.g, color.b];
  if (color.a !== undefined) parts.push(color.a);
  return `(${parts.join(", ")})`;
}

/** CSS colour for a swatch. Alpha 0–255 becomes 0–1. */
export function cssColor(color: Pick<ColorCount, "r" | "g" | "b" | "a">): string {
  const { r, g, b, a } = color;
  return a === undefined
    ? `rgb(${r} ${g} ${b})`
    : `rgb(${r} ${g} ${b} / ${Number((a / 255).toFixed(6))})`;
}

/** Percent with 6 decimals, as the original results page showed it. */
export function formatPercent(percent: number): string {
  return `${percent.toFixed(6)}%`;
}

/** `#RRGGBB` without alpha, for display; the CSV keeps `formatHex`. */
export const hexOf = (c: Pick<ColorCount, "r" | "g" | "b">) => formatHex({ r: c.r, g: c.g, b: c.b });

/** Alpha 0–255 as a readable opacity, e.g. "läbipaistmatus 50 %" (#90: "000" said nothing). */
export function formatOpacity(a: number): string {
  return `läbipaistmatus ${Math.round((a / 255) * 100)} %`;
}
