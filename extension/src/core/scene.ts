// The scene metadata S2 writes into scene.svg as <metadata id="fs-scene">.
// It describes the page in design-tool terms (frames with fills, strokes,
// radii and effects; text with the font really used; images; vectors; patches
// for what no vector format can hold). The Figma plugin (#46) reads only this.

/** r, g, b 0–255 and alpha 0–1, as the browser reports it. */
export type RgbaTuple = [number, number, number, number];

/** x, y, width, height in viewport CSS px. */
export type Box = [number, number, number, number];

export type Fill =
  | { type: "solid"; color: RgbaTuple | null }
  | { type: "linear"; angle: number; stops: { pos: number; color: RgbaTuple | null }[] };

export interface Effect {
  type: "drop-shadow" | "inner-shadow";
  x: number;
  y: number;
  blur: number;
  spread: number;
  color: RgbaTuple | null;
}

export interface NodeStyle {
  fills?: Fill[];
  /** Corner radii: top-left, top-right, bottom-right, bottom-left. */
  radii?: number[];
  effects?: Effect[];
  /** Border widths and colours per side: top, right, bottom, left. */
  strokes?: { weights: number[]; colors: (RgbaTuple | null)[]; uniform: boolean };
  opacity?: number;
  clip?: boolean;
}

export interface NodeSource {
  tag: string;
  id?: string;
  classes?: string[];
  role?: string;
  label?: string;
  testid?: string;
  /** Set on canvases whose bitmap F1 replaced with fitted vectors. */
  fitted?: boolean;
}

export interface TextInfo {
  characters: string;
  usedFamily: string;
  substitute: string | null;
  requested: string[];
  weight: number;
  italic: boolean;
  size: number;
  lineHeight: number;
  letterSpacing: number;
  decoration: string;
  fill: RgbaTuple | null;
  baseline: number;
  width: number;
}

export interface ControlInfo {
  type: string;
  checked?: boolean;
  disabled: boolean;
  text: string | null;
  uaBorder: boolean;
  color: RgbaTuple | null;
  accent: RgbaTuple | null;
  font: { usedFamily: string; size: number; weight: number; italic: boolean; ascent: number; descent: number };
  content: Box;
}

export interface SceneNode {
  id: string;
  kind: "frame" | "text" | "image" | "vector" | "patch";
  name: string;
  box: Box;
  source?: NodeSource;
  style?: NodeStyle;
  children?: SceneNode[];
  layout?: { mode: "row" | "column"; gap: number; padding: number[]; align: string; justify: string; wrap: boolean };
  text?: TextInfo;
  image?: { asset: string; backing: [number, number] };
  vector?: { svg: string };
  patch?: { reason: string; bitmap?: string; [key: string]: unknown };
  control?: ControlInfo;
  pseudo?: string;
  confidence?: string;
  [key: string]: unknown;
}

/** A region the SVG cannot draw faithfully; the pixel check leaves it out. */
export interface Unsupported {
  why: string;
  x: number;
  y: number;
  w: number;
  h: number;
  pad?: number;
  svgOnly?: boolean;
}

/** One line of text as drawn, for the combination steps. */
export interface TextRun {
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
  baseline: number;
  family: string;
  usedFamily: string;
  size: number;
  weight: string;
  style: string;
  color: string;
  pseudo?: string;
}

export interface FontUse {
  used: string;
  substitute: string | null;
  runs: number;
  checked: number;
  maxWidthDelta: number;
  substituteAvailableHere: boolean;
}

export interface SceneMeta {
  version: 1;
  viewport: [number, number];
  dpr: number;
  url: string;
  shot: string;
  fonts: FontUse[];
  root: SceneNode;
  /** Embedded images as data URLs, by asset key. */
  assets: Record<string, string>;
  unsupported: Unsupported[];
  env?: unknown;
}

const META = /<metadata id="fs-scene">([\s\S]*?)<\/metadata>/;

/**
 * Puts the metadata inside the SVG. `<`, `>` and `&` become JSON unicode
 * escapes, so the JSON cannot clash with the XML and needs no CDATA.
 */
export function embedMeta(svg: string, meta: SceneMeta): string {
  const json = JSON.stringify(meta).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
  const tag = `<metadata id="fs-scene">${json}</metadata>`;
  return META.test(svg) ? svg.replace(META, () => tag) : svg.replace("<defs>", () => `${tag}<defs>`);
}

export function readMeta(svg: string): SceneMeta | null {
  const m = svg.match(META);
  return m ? (JSON.parse(m[1]) as SceneMeta) : null;
}

/**
 * The SVG for pixel checks: without metadata (smaller) and without width
 * pinning, so glyphs land where this browser's own shaping puts them.
 */
export const forCheck = (svg: string) => svg.replace(META, "").replace(/ textLength="[^"]*" lengthAdjust="spacing"/g, "");

export function walkNodes(node: SceneNode, fn: (node: SceneNode, parent: SceneNode | null) => void, parent: SceneNode | null = null) {
  fn(node, parent);
  for (const c of node.children ?? []) walkNodes(c, fn, node);
}
