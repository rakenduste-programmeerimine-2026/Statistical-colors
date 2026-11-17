// Decisions of the Intent Capture Import plugin that need no Figma API, so
// they can be tested on their own: font choice, paints, the gradient matrix,
// border plans, the geometry and brightness checks, and the report text.
// The build joins this file with code.ts (main thread) and ui.ts (iframe),
// because Figma loads each as one plain script (see build.mjs).
import type { Effect as SceneEffect, Fill, NodeStyle, RgbaTuple, SceneMeta, SceneNode, TextInfo } from "../../extension/src/core/scene.ts";

/** Acceptance: every layer's box within half a CSS pixel of the captured one. */
export const EPS = 0.5;

/**
 * Width-equivalent open fonts (Google fonts, which Figma has everywhere).
 * Must equal the extension's list; a test checks that.
 */
export const SUBSTITUTES: Record<string, string> = {
  arial: "Arimo",
  helvetica: "Arimo",
  "liberation sans": "Arimo",
  "times new roman": "Tinos",
  times: "Tinos",
  "liberation serif": "Tinos",
  "courier new": "Cousine",
  "liberation mono": "Cousine",
  calibri: "Carlito",
  cambria: "Caladea",
  georgia: "Gelasio",
};
export const LAST_RESORT = ["Inter", "Roboto", "Arial"];
/** Style names per CSS weight, most usual first. */
export const WEIGHTS: Record<number, string[]> = {
  100: ["Thin", "Hairline"],
  200: ["ExtraLight", "Extra Light", "UltraLight"],
  300: ["Light"],
  400: ["Regular", "Normal", "Book", "Roman"],
  500: ["Medium"],
  600: ["SemiBold", "Semi Bold", "DemiBold"],
  700: ["Bold"],
  800: ["ExtraBold", "Extra Bold", "UltraBold"],
  900: ["Black", "Heavy"],
};

export type FontIndex = Record<string, { family: string; styles: string[] }>;
export type FontHow = "exact" | "substitute" | "fallback";

const normName = (s: string) => s.toLowerCase().replace(/[\s_-]+/g, "");

/** Fonts by lower-case family, from Figma's list of available fonts. */
export function buildFontIndex(list: { fontName: { family: string; style: string } }[]): FontIndex {
  const index: FontIndex = {};
  for (const { fontName } of list) {
    const key = fontName.family.toLowerCase();
    (index[key] ??= { family: fontName.family, styles: [] }).styles.push(fontName.style);
  }
  return index;
}

/** The closest available style for a CSS weight and italic: nearest weight first, italic given up last. */
export function pickStyle(styles: string[], weight: number, italic: boolean): { style: string; exact: boolean } {
  const byNorm: Record<string, string> = {};
  for (const s of styles) byNorm[normName(s)] = s;
  const ws = Object.keys(WEIGHTS)
    .map(Number)
    .sort((a, b) => Math.abs(a - weight) - Math.abs(b - weight));
  for (let pass = 0; pass < 2; pass++) {
    const wantItalic = italic && pass === 0;
    for (const w of ws) {
      for (const name of WEIGHTS[w]) {
        const tries = wantItalic ? [`${name} Italic`, `${name} Oblique`] : [name];
        if (wantItalic && w === 400) tries.push("Italic", "Oblique");
        for (const t of tries) {
          const hit = byNorm[normName(t)];
          if (hit) return { style: hit, exact: w === weight && (!italic || wantItalic) };
        }
      }
    }
    if (!italic) break;
  }
  return { style: styles[0], exact: false };
}

export interface ResolvedFont {
  fontName: { family: string; style: string };
  how: FontHow;
  styleExact: boolean;
}

/** Which font a text run gets: the font used in the browser, its open substitute, or a last resort. */
export function resolveFont(t: Pick<TextInfo, "usedFamily" | "substitute" | "weight" | "italic">, preferSubstitute: boolean, index: FontIndex): ResolvedFont | null {
  const sub = t.substitute || SUBSTITUTES[t.usedFamily.toLowerCase()] || null;
  const order: [string | null, FontHow][] = preferSubstitute
    ? [
        [sub, "substitute"],
        [t.usedFamily, "exact"],
      ]
    : [
        [t.usedFamily, "exact"],
        [sub, "substitute"],
      ];
  for (const f of LAST_RESORT) order.push([f, "fallback"]);
  for (const [fam, how] of order) {
    if (!fam) continue;
    const entry = index[fam.toLowerCase()];
    if (!entry) continue;
    const st = pickStyle(entry.styles, t.weight || 400, !!t.italic);
    return { fontName: { family: entry.family, style: st.style }, how, styleExact: st.exact };
  }
  return null;
}

export const solid = (c: RgbaTuple | number[]): SolidPaint => ({
  type: "SOLID",
  color: { r: c[0] / 255, g: c[1] / 255, b: c[2] / 255 },
  opacity: c[3] === undefined ? 1 : c[3],
});
export const rgbaOf = (c: RgbaTuple | null): RGBA => (c ? { r: c[0] / 255, g: c[1] / 255, b: c[2] / 255, a: c[3] === undefined ? 1 : c[3] } : { r: 0, g: 0, b: 0, a: 0 });

/**
 * A CSS linear-gradient angle as Figma's gradientTransform for a w × h node.
 * Figma's matrix maps node space (0..1) to gradient space, where the gradient
 * runs from (0, 0.5) to (1, 0.5); this builds gradient → node and inverts it.
 */
export function gradientTransform(angleDeg: number, w: number, h: number): Transform {
  const a = (angleDeg * Math.PI) / 180;
  const dx = Math.sin(a);
  const dy = -Math.cos(a);
  const len = Math.abs(w * dx) + Math.abs(h * dy);
  const sx = 0.5 - (dx * len) / 2 / w; // start, normalised
  const sy = 0.5 - (dy * len) / 2 / h;
  const vx = (dx * len) / w; // start → end, normalised
  const vy = (dy * len) / h;
  const px = -(dy * len) / w; // perpendicular, normalised
  const py = (dx * len) / h;
  const tx = sx - 0.5 * px;
  const ty = sy - 0.5 * py;
  const det = vx * py - px * vy;
  return [
    [py / det, -px / det, (px * ty - py * tx) / det],
    [-vy / det, vx / det, (vy * tx - vx * ty) / det],
  ];
}

export function fillsOf(style: NodeStyle, w: number, h: number): Paint[] {
  const out: Paint[] = [];
  for (const f of style.fills ?? ([] as Fill[])) {
    if (f.type === "solid" && f.color) out.push(solid(f.color));
    else if (f.type === "linear") {
      out.push({
        type: "GRADIENT_LINEAR",
        gradientTransform: gradientTransform(f.angle, w, h),
        gradientStops: f.stops.map((s) => ({ position: Math.max(0, Math.min(1, s.pos)), color: rgbaOf(s.color) })),
      });
    }
  }
  return out;
}

export function effectsOf(style: NodeStyle): Effect[] {
  return (style.effects ?? ([] as SceneEffect[])).map((e) => ({
    type: e.type === "inner-shadow" ? "INNER_SHADOW" : "DROP_SHADOW",
    color: rgbaOf(e.color),
    offset: { x: e.x, y: e.y },
    radius: e.blur,
    visible: true,
    blendMode: "NORMAL",
    ...(e.spread ? { spread: e.spread } : {}),
  }));
}

export type StrokePlan =
  | { kind: "none" }
  /** One paint for every side; per-side weights when they differ. */
  | { kind: "stroke"; color: RgbaTuple; uniform: boolean; weights: number[] }
  /** Sides in different colours: Figma has one stroke paint per node, so each side becomes a thin rectangle. */
  | { kind: "sides"; rects: { name: string; x: number; y: number; w: number; h: number; color: RgbaTuple }[] };

export function strokePlan(style: NodeStyle, w: number, h: number): StrokePlan {
  const s = style.strokes;
  if (!s) return { kind: "none" };
  const { weights: ws, colors: cs } = s;
  let first: RgbaTuple | null = null;
  let sameColour = true;
  for (let i = 0; i < 4; i++) {
    const c = cs[i];
    if (!ws[i] || !c) continue;
    if (!first) first = c;
    else if (c.join() !== first.join()) sameColour = false;
  }
  if (!first) return { kind: "none" };
  if (sameColour) return { kind: "stroke", color: first, uniform: s.uniform, weights: ws };
  const boxes = [
    [0, 0, w, ws[0]],
    [w - ws[1], 0, ws[1], h],
    [0, h - ws[2], w, ws[2]],
    [0, 0, ws[3], h],
  ];
  const names = ["border-top", "border-right", "border-bottom", "border-left"];
  const rects: { name: string; x: number; y: number; w: number; h: number; color: RgbaTuple }[] = [];
  boxes.forEach(([x, y, rw, rh], i) => {
    const c = cs[i];
    if (ws[i] && c) rects.push({ name: names[i], x, y, w: rw, h: rh, color: c });
  });
  return { kind: "sides", rects };
}

/** The scene metadata from scene.svg, or why it cannot be read. */
export function readSceneMeta(svgText: string): { meta: SceneMeta } | { error: string } {
  const m = svgText.match(/<metadata id="fs-scene">([\s\S]*?)<\/metadata>/);
  if (!m) return { error: "has no capture metadata. Capture again with the current extension." };
  try {
    const meta = JSON.parse(m[1]) as SceneMeta;
    if (meta.version !== 1 || !meta.root) return { error: "has capture metadata of an unknown version." };
    return { meta };
  } catch (e) {
    return { error: `has metadata that is not valid JSON: ${(e as Error).message}` };
  }
}

export const countNodes = (n: SceneNode): number => 1 + (n.children ?? []).reduce((s, c) => s + countNodes(c), 0);

/** Brightness-only comparison of two RGBA images of the same size (Figma's rasteriser is not the browser's). */
export function compareBrightness(a: { width: number; height: number; data: ArrayLike<number> }, b: { width: number; height: number; data: ArrayLike<number> }) {
  if (a.width !== b.width || a.height !== b.height) return { sizeMatch: false, within8Pct: null, within48Pct: null };
  const n = a.width * a.height;
  let n8 = 0;
  let n48 = 0;
  for (let i = 0; i < n * 4; i += 4) {
    const d = Math.abs(a.data[i] + a.data[i + 1] + a.data[i + 2] - b.data[i] - b.data[i + 1] - b.data[i + 2]) / 3;
    if (d <= 8) n8++;
    if (d <= 48) n48++;
  }
  return { sizeMatch: true, within8Pct: Math.round((n8 / n) * 1e4) / 100, within48Pct: Math.round((n48 / n) * 1e4) / 100 };
}

/** A built layer as the geometry check sees it: absolute position and size. */
export interface Placed {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Compares every built layer's box with the captured one. Text height is not compared. */
export function geometry(placed: Placed[], meta: SceneMeta) {
  const byId: Record<string, SceneNode> = {};
  const walk = (n: SceneNode) => {
    byId[n.id] = n;
    (n.children ?? []).forEach(walk);
  };
  walk(meta.root);
  let worst = 0;
  let checked = 0;
  const outside: { name: string; kind: string; delta: number }[] = [];
  for (const p of placed) {
    const n = byId[p.id];
    if (!n) continue;
    const d = Math.max(Math.abs(p.x - n.box[0]), Math.abs(p.y - n.box[1]), Math.abs(p.width - n.box[2]), n.kind === "text" ? 0 : Math.abs(p.height - n.box[3]));
    checked++;
    worst = Math.max(worst, d);
    if (d > EPS) outside.push({ name: n.name, kind: n.kind, delta: Math.round(d * 100) / 100 });
  }
  return { checked, withinEps: checked - outside.length, worst: Math.round(worst * 100) / 100, outside };
}

export interface LayerStatus {
  id: string;
  name: string;
  kind: string;
  status: "exact" | "substitute" | "fallback" | "pinned" | "patch";
  reason?: string;
  widthDelta?: number;
  pseudo?: string | null;
}

export interface FontRecord {
  how: FontHow;
  runs: number;
  widthOk: number;
  maxDelta: number;
}

/** The text of the "Import report" layer. */
export function reportLines(
  status: LayerStatus[],
  fonts: Record<string, FontRecord>,
  geo: ReturnType<typeof geometry>,
  pixels: { brightnessWithin8Pct: number | null; brightnessWithin48Pct: number | null } | null,
  notes: string[],
  analysisAttached: boolean,
): string[] {
  const counts: Record<string, number> = {};
  for (const s of status) counts[s.status] = (counts[s.status] ?? 0) + 1;
  const lines = [
    "Intent Capture Import",
    "",
    `${status.length} layers: ${Object.entries(counts)
      .map(([k, v]) => `${v} ${k}`)
      .join(", ")}`,
    `Geometry: ${geo.withinEps} of ${geo.checked} within ${EPS} px (worst ${geo.worst} px)`,
  ];
  if (pixels) lines.push(`Brightness vs screenshot: ${pixels.brightnessWithin8Pct}% within ±8, ${pixels.brightnessWithin48Pct}% within ±48`);
  lines.push(`Colour analysis: ${analysisAttached ? "attached" : "not attached"}`);
  lines.push("", "Fonts:");
  for (const [k, f] of Object.entries(fonts)) lines.push(`  ${k} — ${f.how}, ${f.widthOk}/${f.runs} widths equal, max Δ ${f.maxDelta} px`);
  const odd = status.filter((s) => s.status !== "exact");
  if (odd.length) {
    lines.push("", "Not exact:");
    for (const s of odd.slice(0, 40)) lines.push(`  ${s.status} · ${s.kind} · ${s.name || s.id}${s.reason ? ` (${s.reason})` : ""}`);
  }
  if (notes.length) {
    lines.push("", "Notes:");
    for (const x of notes.slice(0, 20)) lines.push(`  ${x}`);
  }
  return lines;
}
