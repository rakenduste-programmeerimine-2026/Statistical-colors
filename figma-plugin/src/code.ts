// Intent Capture Import, main thread. Builds native Figma layers from the
// scene metadata the capture extension embeds in scene.svg (#46).
// Only the Figma API is used here; files, image decoding, cropping and the
// pixel comparison happen in the UI (ui.ts) and arrive as messages.
import type { SceneMeta, SceneNode } from "../../extension/src/core/scene.ts";
import {
  buildFontIndex,
  effectsOf,
  EPS,
  fillsOf,
  geometry,
  reportLines,
  resolveFont,
  solid,
  strokePlan,
  type FontIndex,
  type FontRecord,
  type LayerStatus,
  type Placed,
} from "./logic.ts";

/** What the UI sends to start an import. */
export interface ImportMessage {
  type: "import";
  meta: SceneMeta;
  /** Image bytes by asset key, decoded in the UI. */
  assets: Record<string, Uint8Array>;
  /** Bitmaps for patch nodes, by node id. */
  patches: Record<string, Uint8Array>;
  /** The lossless screenshot, when it was dropped in. */
  shot: Uint8Array | null;
  /**
   * PLACEHOLDER(#48): the stored colour analysis for this capture, attached to
   * the import as optional metadata. The backend read for it does not exist
   * yet, so the UI always sends null.
   */
  analysis: unknown;
  options: { preferSubstitute: boolean };
}

interface Ctx {
  assets: Record<string, Uint8Array>;
  patches: Record<string, Uint8Array>;
  options: ImportMessage["options"];
  fontIndex: FontIndex;
  status: LayerStatus[];
  notes: string[];
  fonts: Record<string, FontRecord>;
}

const errorText = (e: unknown) => String((e as Error)?.message ?? e);

// ---- request and reply with the UI ------------------------------------------------
const pending: Record<number, (msg: Record<string, unknown>) => void> = {};
let seq = 0;
function ask(type: string, payload: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    const reqId = ++seq;
    pending[reqId] = resolve;
    figma.ui.postMessage({ ...payload, type, reqId });
  });
}
const log = (text: string) => figma.ui.postMessage({ type: "log", text });

// ---- fonts --------------------------------------------------------------------------
const loaded: Record<string, Promise<void>> = {};
function loadFont(fontName: FontName) {
  const key = `${fontName.family}|${fontName.style}`;
  loaded[key] ??= figma.loadFontAsync(fontName);
  return loaded[key];
}

// ---- node builders ------------------------------------------------------------------
function place(node: SceneNode2, n: SceneNode, parent: BaseNode & ChildrenMixin, origin: [number, number]) {
  parent.appendChild(node);
  node.x = n.box[0] - origin[0];
  node.y = n.box[1] - origin[1];
  node.name = n.name || n.kind;
  node.setPluginData("fs", JSON.stringify({ id: n.id, kind: n.kind, source: n.source ?? null, pseudo: n.pseudo ?? null, confidence: n.confidence ?? null }));
}
type SceneNode2 = FrameNode | RectangleNode | TextNode;
const size = (node: LayoutMixin, w: number, h: number) => node.resize(Math.max(0.01, w), Math.max(0.01, h));

function buildFrame(n: SceneNode, parent: BaseNode & ChildrenMixin, origin: [number, number], ctx: Ctx): FrameNode {
  const f = figma.createFrame();
  const st = n.style ?? {};
  const [, , w, h] = n.box;
  size(f, w, h);
  f.fills = fillsOf(st, w, h);
  f.clipsContent = !!st.clip;
  if (st.radii) {
    [f.topLeftRadius, f.topRightRadius, f.bottomRightRadius, f.bottomLeftRadius] = st.radii;
  }
  if (st.opacity !== undefined) f.opacity = st.opacity;
  const fx = effectsOf(st);
  if (fx.length) {
    f.effects = fx;
    // A CSS shadow is cast by the box; a Figma shadow by what the frame draws, so an unfilled box differs.
    if (!(f.fills as Paint[]).length) ctx.notes.push(`Shadow on a box with no fill may render differently: ${n.name}`);
  }
  const plan = strokePlan(st, w, h);
  if (plan.kind === "stroke") {
    f.strokes = [solid(plan.color)];
    f.strokeAlign = "INSIDE";
    if (plan.uniform) f.strokeWeight = plan.weights[0];
    else [f.strokeTopWeight, f.strokeRightWeight, f.strokeBottomWeight, f.strokeLeftWeight] = plan.weights;
  }
  place(f, n, parent, origin);
  if (plan.kind === "sides") {
    for (const s of plan.rects) {
      const r = figma.createRectangle();
      size(r, s.w, s.h);
      r.fills = [solid(s.color)];
      f.appendChild(r);
      r.x = s.x;
      r.y = s.y;
      r.name = s.name;
    }
  }
  return f;
}

async function buildText(n: SceneNode, parent: BaseNode & ChildrenMixin, origin: [number, number], ctx: Ctx): Promise<TextNode> {
  const t = n.text;
  if (!t) throw new Error("text node without text");
  const res = resolveFont(t, ctx.options.preferSubstitute, ctx.fontIndex);
  if (!res) throw new Error("no usable font");
  await loadFont(res.fontName);
  const node = figma.createText();
  node.fontName = res.fontName;
  node.fontSize = t.size;
  if (t.lineHeight) node.lineHeight = { unit: "PIXELS", value: t.lineHeight };
  node.letterSpacing = { unit: "PIXELS", value: t.letterSpacing || 0 };
  node.textAutoResize = "WIDTH_AND_HEIGHT";
  node.characters = t.characters;
  node.fills = [solid(t.fill ?? [0, 0, 0, 1])];
  if (/underline/.test(t.decoration || "")) node.textDecoration = "UNDERLINE";
  else if (/line-through/.test(t.decoration || "")) node.textDecoration = "STRIKETHROUGH";
  place(node, n, parent, origin);

  // Width test: an equal width means the font is width-equivalent for this string.
  const delta = t.width - node.width;
  const widthOk = Math.abs(delta) <= EPS;
  let status: LayerStatus["status"] = res.how === "exact" && res.styleExact ? "exact" : res.how;
  if (!widthOk && t.characters.length > 0) {
    // Letter spacing pins the run to its captured width, so it cannot push into its neighbour.
    node.letterSpacing = { unit: "PIXELS", value: (t.letterSpacing || 0) + delta / t.characters.length };
    status = "pinned";
  }
  const key = `${t.usedFamily} → ${res.fontName.family} ${res.fontName.style}`;
  const rec = (ctx.fonts[key] ??= { how: res.how, runs: 0, widthOk: 0, maxDelta: 0 });
  rec.runs++;
  if (widthOk) rec.widthOk++;
  rec.maxDelta = Math.max(rec.maxDelta, Math.round(Math.abs(delta) * 100) / 100);
  ctx.status.push({ id: n.id, name: n.name, kind: "text", status, widthDelta: Math.round(delta * 100) / 100, pseudo: n.pseudo ?? null });
  return node;
}

const imageFill = (bytes: Uint8Array): Paint[] => [{ type: "IMAGE", scaleMode: "FILL", imageHash: figma.createImage(bytes).hash }];

function buildImage(n: SceneNode, parent: BaseNode & ChildrenMixin, origin: [number, number], bytes: Uint8Array, label?: string) {
  const r = figma.createRectangle();
  size(r, n.box[2], n.box[3]);
  r.fills = imageFill(bytes);
  place(r, n, parent, origin);
  if (label) r.name = label;
  return r;
}

async function patch(n: SceneNode, parent: BaseNode & ChildrenMixin, origin: [number, number], ctx: Ctx, reason: string) {
  let bytes: Uint8Array | undefined = ctx.patches[n.id];
  if (!bytes) bytes = (await ask("crop", { box: n.box })).bytes as Uint8Array | undefined;
  let r: RectangleNode;
  if (bytes?.length) r = buildImage(n, parent, origin, bytes, `patch · ${reason} · ${n.name || ""}`);
  else {
    // No screenshot was dropped in: a visible placeholder rather than a hole.
    r = figma.createRectangle();
    size(r, n.box[2], n.box[3]);
    r.fills = [solid([230, 230, 230, 1])];
    r.strokes = [solid([200, 60, 60, 1])];
    r.strokeWeight = 1;
    r.dashPattern = [4, 4];
    place(r, n, parent, origin);
    r.name = `missing · ${reason} · ${n.name || ""}`;
  }
  ctx.status.push({ id: n.id, name: n.name, kind: n.kind, status: "patch", reason });
  return r;
}

async function buildNode(n: SceneNode, parent: BaseNode & ChildrenMixin, origin: [number, number], ctx: Ctx): Promise<SceneNode2 | FrameNode> {
  try {
    if (n.kind === "frame") {
      const f = buildFrame(n, parent, origin, ctx);
      ctx.status.push({ id: n.id, name: n.name, kind: "frame", status: "exact" });
      for (const kid of n.children ?? []) await buildNode(kid, f, [n.box[0], n.box[1]], ctx);
      return f;
    }
    if (n.kind === "text") return await buildText(n, parent, origin, ctx);
    if (n.kind === "image") {
      const bytes = n.image && ctx.assets[n.image.asset];
      if (!bytes) throw new Error("image bytes missing");
      const img = buildImage(n, parent, origin, bytes);
      ctx.status.push({ id: n.id, name: n.name, kind: "image", status: "exact" });
      return img;
    }
    if (n.kind === "vector") {
      if (!n.vector) throw new Error("vector node without SVG");
      const v = figma.createNodeFromSvg(n.vector.svg);
      if (Math.abs(v.width - n.box[2]) > EPS || Math.abs(v.height - n.box[3]) > EPS) size(v, n.box[2], n.box[3]);
      place(v, n, parent, origin);
      ctx.status.push({ id: n.id, name: n.name, kind: "vector", status: "exact" });
      return v;
    }
    if (n.kind === "patch") return await patch(n, parent, origin, ctx, String(n.patch?.reason ?? "unsupported"));
    throw new Error(`unknown kind ${n.kind}`);
  } catch (e) {
    // Anything that cannot be built natively becomes a labelled bitmap of what was on screen.
    ctx.notes.push(`${n.name || n.id}: ${errorText(e)} → patch`);
    return patch(n, parent, origin, ctx, "build-failed");
  }
}

/** Every layer this import made, with its position relative to the root frame. */
function placedLayers(root: FrameNode): Placed[] {
  const rx = root.absoluteTransform[0][2];
  const ry = root.absoluteTransform[1][2];
  const out: Placed[] = [];
  for (const node of root.findAll(() => true)) {
    const raw = node.getPluginData("fs");
    if (!raw) continue;
    const at = (node as LayoutMixin).absoluteTransform;
    const { width, height } = node as LayoutMixin;
    out.push({ id: (JSON.parse(raw) as { id: string }).id, x: at[0][2] - rx, y: at[1][2] - ry, width, height });
  }
  return out;
}

export async function run(msg: ImportMessage) {
  const { meta } = msg;
  const t0 = Date.now();
  if (!meta || meta.version !== 1 || !meta.root) throw new Error("This file has no version-1 capture metadata.");
  log("Reading available fonts…");
  const ctx: Ctx = {
    assets: msg.assets ?? {},
    patches: msg.patches ?? {},
    options: msg.options ?? { preferSubstitute: false },
    fontIndex: buildFontIndex(await figma.listAvailableFontsAsync()),
    status: [],
    notes: [],
    fonts: {},
  };

  const page = figma.currentPage;
  log("Building layers…");
  const root = (await buildNode(meta.root, page, [0, 0], ctx)) as FrameNode;
  root.name = `Capture · ${meta.url || "page"}`;
  const c = figma.viewport.center;
  root.x = Math.round(c.x - meta.viewport[0] / 2);
  root.y = Math.round(c.y - meta.viewport[1] / 2);
  // The colour analysis travels with the frame as plugin data (P-023 item 3).
  const analysisAttached = msg.analysis !== null && msg.analysis !== undefined;
  if (analysisAttached) root.setPluginData("fs-analysis", JSON.stringify(msg.analysis));

  // The lossless screenshot goes into the frame too, hidden and locked, for comparing by eye.
  if (msg.shot) {
    const ref = figma.createRectangle();
    size(ref, meta.viewport[0], meta.viewport[1]);
    ref.fills = imageFill(msg.shot);
    root.insertChild(0, ref);
    ref.x = 0;
    ref.y = 0;
    ref.name = "shot.png (reference)";
    ref.visible = false;
    ref.locked = true;
  }

  log("Checking geometry…");
  const geo = geometry(placedLayers(root), meta);
  let pixels: { sizeMatch: boolean; brightnessWithin8Pct: number | null; brightnessWithin48Pct: number | null } | null = null;
  if (msg.shot) {
    log("Comparing with the screenshot…");
    const png = await root.exportAsync({ format: "PNG", constraint: { type: "SCALE", value: meta.dpr || 1 } });
    const v = await ask("verify", { bytes: png });
    pixels = { sizeMatch: v.sizeMatch as boolean, brightnessWithin8Pct: v.within8Pct as number | null, brightnessWithin48Pct: v.within48Pct as number | null };
  }

  const counts: Record<string, number> = {};
  for (const s of ctx.status) counts[s.status] = (counts[s.status] ?? 0) + 1;
  const report = {
    layers: ctx.status.length,
    byStatus: counts,
    fonts: ctx.fonts,
    geometry: geo,
    pixels,
    analysisAttached,
    captureFlags: (meta.unsupported ?? []).map((u) => u.why),
    notes: ctx.notes,
    ms: Date.now() - t0,
  };

  // A report text layer next to the import.
  try {
    await loadFont({ family: "Inter", style: "Regular" });
    const rep = figma.createText();
    rep.fontName = { family: "Inter", style: "Regular" };
    rep.fontSize = 12;
    rep.characters = reportLines(ctx.status, ctx.fonts, geo, pixels, ctx.notes, analysisAttached).join("\n");
    page.appendChild(rep);
    rep.x = root.x + meta.viewport[0] + 40;
    rep.y = root.y;
    rep.name = "Import report";
  } catch (e) {
    ctx.notes.push(`Report layer skipped: ${errorText(e)}`);
  }

  page.selection = [root];
  figma.viewport.scrollAndZoomIntoView([root]);
  figma.notify(`Imported ${ctx.status.length} layers`);
  figma.ui.postMessage({ type: "done", ok: true, report });
  return report;
}

/** Starts the plugin. The build calls it once, last; tests call it with a fake figma. */
export function start() {
  figma.showUI(__html__, { width: 400, height: 560 });
  figma.ui.onmessage = (msg: Record<string, unknown>) => {
    const reqId = msg.reqId as number | undefined;
    if (reqId && pending[reqId]) {
      const resolve = pending[reqId];
      delete pending[reqId];
      resolve(msg);
      return;
    }
    if (msg.type === "import") {
      run(msg as unknown as ImportMessage).catch((e) => figma.ui.postMessage({ type: "done", ok: false, error: errorText(e) }));
    }
  };
}
