// Geometry for the colour-structure wheel (P-031 item 4). Hue 0° points up and
// angles grow clockwise; distance from the centre grows with chroma.

/** The ring is drawn at this OKLCH lightness and chroma: the widest constant chroma inside sRGB for every hue (experiment E2). */
export const WHEEL_L = 0.75;
export const WHEEL_C = 0.127;
/** Chroma below this is not trusted for hue (experiment E7: a one-step change moves the hue up to 9°). */
export const LOW_CHROMA = 0.04;
/** Chroma at the outer edge of the plot. */
export const MAX_CHROMA = 0.32;

export interface Point {
  x: number;
  y: number;
}

export function polar(hue: number, radius: number, cx: number, cy: number): Point {
  const a = (hue * Math.PI) / 180;
  return { x: cx + radius * Math.sin(a), y: cy - radius * Math.cos(a) };
}

/** An annular sector from hue h0 to h1 (clockwise), as an SVG path. */
export function arcPath(h0: number, h1: number, rInner: number, rOuter: number, cx: number, cy: number): string {
  const f = (v: number) => Number(v.toFixed(3));
  const large = (((h1 - h0) % 360) + 360) % 360 > 180 ? 1 : 0;
  const o0 = polar(h0, rOuter, cx, cy);
  const o1 = polar(h1, rOuter, cx, cy);
  const i1 = polar(h1, rInner, cx, cy);
  const i0 = polar(h0, rInner, cx, cy);
  return (
    `M${f(o0.x)} ${f(o0.y)}A${rOuter} ${rOuter} 0 ${large} 1 ${f(o1.x)} ${f(o1.y)}` +
    `L${f(i1.x)} ${f(i1.y)}A${rInner} ${rInner} 0 ${large} 0 ${f(i0.x)} ${f(i0.y)}Z`
  );
}

/** `n` equal segments covering the circle: start and end hue, and the hue at the middle. */
export function ringSegments(n = 72): { h0: number; h1: number; mid: number }[] {
  const step = 360 / n;
  return Array.from({ length: n }, (_, i) => ({ h0: i * step, h1: (i + 1) * step, mid: (i + 0.5) * step }));
}

/**
 * Distance from the centre for a chroma: low-chroma colours sit inside the
 * achromatic core (radius < core), the rest spread out to `outer`.
 */
export function chromaRadius(c: number, core: number, outer: number): number {
  if (c < LOW_CHROMA) return (Math.max(0, c) / LOW_CHROMA) * core * 0.85;
  const t = Math.min(1, (c - LOW_CHROMA) / (MAX_CHROMA - LOW_CHROMA));
  return core + t * (outer - core);
}

/**
 * Radius of the empty circle at an ideal point: it grows with the point's ΔE
 * to the ideal structure (P-031 item 4). ΔE 0 gives the base size; about 0.02
 * (just noticeable) adds 6 px; it stops growing at `max`.
 */
export function deltaERadius(deltaE: number, base = 7, max = 28): number {
  return Math.min(max, base + Math.max(0, deltaE) * 300);
}
