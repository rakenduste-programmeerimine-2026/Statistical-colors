// S1 · The browser's own record of the scene. Needs the debugger.
// The reference preferred the paint record (LayerTree domain), but Chrome does
// not let extensions use LayerTree, so the extension reads the layout record
// (DOMSnapshot domain): every laid-out box and text fragment with its bounds,
// paint order and colours, pseudo-elements included (P-025 item 6).
// Saves layout.json.
import type { PageInfo } from "../core/page-fns.ts";
import type { ApproachResult, Context } from "../core/pipeline.ts";

export const STYLES = ["color", "background-color", "border-top-color", "font-family", "font-size", "font-weight"] as const;

/** The parts of a DOMSnapshot.captureSnapshot reply that S1 reads. Bounds are document device px. */
export interface DomSnapshot {
  strings: string[];
  documents: {
    layout: {
      nodeIndex: number[];
      bounds: number[][];
      styles: number[][];
      text: number[];
      paintOrders?: number[];
    };
    textBoxes: { layoutIndex: number[]; bounds: number[][]; start: number[]; length: number[] };
  }[];
}

export interface CssBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LayoutNode extends CssBox {
  paintOrder?: number;
  text?: string;
  style: Record<(typeof STYLES)[number], string>;
}

export interface TextBox extends CssBox {
  text: string;
}

/** Converts a snapshot to viewport CSS px and keeps what is on screen, with its declared colours. */
export function readLayout(snap: DomSnapshot, info: PageInfo) {
  const S = snap.strings;
  const { layout: L, textBoxes: T } = snap.documents[0];
  const str = (i: number | undefined) => (i !== undefined && i >= 0 ? S[i] : "");
  const toCss = (b: number[]): CssBox => ({
    x: b[0] / info.dpr - info.scrollX,
    y: b[1] / info.dpr - info.scrollY,
    w: b[2] / info.dpr,
    h: b[3] / info.dpr,
  });
  const onScreen = (r: CssBox) => r.w > 0 && r.h > 0 && r.x < info.vw && r.y < info.vh && r.x + r.w > 0 && r.y + r.h > 0;
  const palette = new Set<string>();
  const nodes: LayoutNode[] = [];
  L.nodeIndex.forEach((_, i) => {
    const r = toCss(L.bounds[i]);
    if (!onScreen(r)) return;
    const style = Object.fromEntries(STYLES.map((name, j) => [name, str(L.styles[i]?.[j])])) as LayoutNode["style"];
    for (const name of STYLES.slice(0, 3)) if (style[name] && style[name] !== "rgba(0, 0, 0, 0)") palette.add(style[name]);
    nodes.push({ ...r, paintOrder: L.paintOrders?.[i], text: str(L.text[i]) || undefined, style });
  });
  const textBoxes: TextBox[] = [];
  T.layoutIndex.forEach((li, i) => {
    const r = toCss(T.bounds[i]);
    if (!onScreen(r)) return;
    textBoxes.push({ ...r, text: str(L.text[li]).substr(T.start[i], T.length[i]) });
  });
  return { palette: [...palette], nodes, textBoxes };
}

export type S1Result = ApproachResult & {
  mode: "layout-record";
  palette: string[];
  nodes: LayoutNode[];
  textBoxes: TextBox[];
};

export const S1 = {
  id: "S1",
  title: "Layout record",
  needsDebugger: true,
  async run(ctx: Context): Promise<S1Result> {
    const info = await ctx.info();
    const snap = await ctx.host.cdp<DomSnapshot>("DOMSnapshot.captureSnapshot", { computedStyles: [...STYLES], includePaintOrder: true });
    const { palette, nodes, textBoxes } = readLayout(snap, info);
    await ctx.save("layout.json", JSON.stringify({ viewport: [info.vw, info.vh], dpr: info.dpr, nodes, textBoxes }));
    return {
      mode: "layout-record",
      palette,
      nodes,
      textBoxes,
      report: { mode: "layout-record", layoutNodes: nodes.length, textBoxes: textBoxes.length, declaredColours: palette.length },
    };
  },
};
