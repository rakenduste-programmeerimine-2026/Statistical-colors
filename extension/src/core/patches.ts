// Resolves "patch" nodes (native form controls and other regions with no DOM
// vector form) into vectors, trying these routes in order:
//
//   pdf     the browser's own drawing commands from the vector PDF (needs S3)
//   dom     rebuilt from computed style plus templates of Chrome's control art
//   traced  outlines traced from the k× re-render, reduced to its own flat colours (needs K1)
//   bitmap  a crop of the screenshot (k× when available), which always works
//
// A route is accepted only when its drawing, rasterised by this browser, is
// close enough to the lossless screenshot in that rectangle.
import type { K1Result } from "../approaches/k1-hires.ts";
import type { S3Result } from "../approaches/s3-pdf.ts";
import { rasteriseSvg, SUBSTITUTES, verifyScene, type S2Result } from "../approaches/s2-scene.ts";
import { TEMPLATES, type ControlTemplate } from "./control-templates.ts";
import { blobToDataUrl, crop, diff, type Pixels } from "./img.ts";
import { parsePdfPage, pathsToSvg, pdfInBox, type PdfPage } from "./pdf-paths.ts";
import { outOf, type Combination, type Context } from "./pipeline.ts";
import { embedMeta, walkNodes, type ControlInfo, type RgbaTuple, type SceneMeta, type SceneNode } from "./scene.ts";
import { quantiseLocal, traceRegion } from "./trace.ts";

/** Small round controls are mostly edge pixels, so the strict (±8) bar is modest. */
export const ACCEPT = { within48Pct: 96, within8Pct: 60 };
/** Patches past this many, or after this long, go straight to a bitmap, unscored (P-025 item 4). */
export const MAX_SCORED_PATCHES = 60;
export const PATCH_MS = 120_000;

const f = (v: number) => +v.toFixed(3);
const rgb = (c: RgbaTuple | number[]) => `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export interface RouteResult {
  svg: string;
  children: SceneNode[];
  detail: Record<string, unknown>;
}

/** Widths of strings in given fonts. Runs inside the page. */
export function measureRuns(list: [string, string][]): number[] {
  const c = document.createElement("canvas").getContext("2d");
  return list.map(([font, text]) => {
    if (!c) return 0;
    c.font = font;
    return c.measureText(text).width;
  });
}
export const cssFont = (ft: ControlInfo["font"]) => `${ft.italic ? "italic " : ""}${ft.weight} ${ft.size}px "${ft.usedFamily}"`;

/** The control's text as SVG plus a metadata node, from its baseline origin. */
export function textPart(node: SceneNode, x: number, baseline: number, width: number): { svg: string; node: SceneNode } {
  const c = node.control as ControlInfo;
  const ft = c.font;
  const text = c.text ?? "";
  const sub = SUBSTITUTES[ft.usedFamily.toLowerCase()] ?? null;
  const fam = [ft.usedFamily, sub]
    .filter(Boolean)
    .map((v) => `'${v}'`)
    .join(", ");
  return {
    svg:
      `<text x="${f(x)}" y="${f(baseline)}" font-family="${esc(fam)}" font-size="${ft.size}" font-weight="${ft.weight}"${ft.italic ? ' font-style="italic"' : ""} ` +
      `fill="${rgb(c.color ?? [0, 0, 0])}" textLength="${f(width)}" lengthAdjust="spacing" xml:space="preserve">${esc(text)}</text>`,
    node: {
      id: `${node.id}t`,
      kind: "text",
      name: text.slice(0, 40),
      box: [f(x), f(baseline - ft.ascent), f(width), f(ft.ascent + ft.descent)],
      text: {
        characters: text,
        usedFamily: ft.usedFamily,
        substitute: sub,
        requested: [ft.usedFamily],
        weight: ft.weight,
        italic: ft.italic,
        size: ft.size,
        lineHeight: f(ft.ascent + ft.descent),
        letterSpacing: 0,
        decoration: "none",
        fill: c.color,
        baseline: f(baseline),
        width: f(width),
      },
    },
  };
}

/** A group of paths as one vector node, with coordinates local to the box. */
const vectorNode = (node: SceneNode, inner: string, name: string): SceneNode => ({
  id: `${node.id}v`,
  kind: "vector",
  name,
  box: [...node.box],
  vector: { svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${node.box[2]}" height="${node.box[3]}" viewBox="0 0 ${node.box[2]} ${node.box[3]}">${inner}</svg>` },
});
const local = (node: SceneNode, inner: string) => `<g transform="translate(${node.box[0]} ${node.box[1]})">${inner}</g>`;

// ---- route: pdf ----------------------------------------------------------------
export function fromPdf(node: SceneNode, pdf: PdfPage, scroll: [number, number], widths: Map<string, number>): RouteResult | null {
  const [x, y, w, h] = node.box;
  const got = pdfInBox(pdf, x + scroll[0], y + scroll[1], w, h);
  if (!got.paths.length || got.paths.some((p) => p.fill === "pattern" || p.stroke === "pattern")) return null;
  const inner = pathsToSvg(got.paths, x + scroll[0], y + scroll[1]);
  const out: RouteResult = { svg: local(node, inner), children: [vectorNode(node, inner, "control art (from PDF)")], detail: { paths: got.paths.length } };
  if (node.control?.text) {
    // The control shows text but the PDF has none here: the route does not fit.
    if (!got.texts.length) return null;
    // The leftmost glyph run marks the start of the baseline.
    const o = got.texts.reduce((a, b) => (b.x < a.x ? b : a));
    const t = textPart(node, o.x - scroll[0], o.y - scroll[1], widths.get(node.id) ?? 0);
    out.svg += t.svg;
    out.children.push(t.node);
  }
  return out;
}

// ---- route: dom + templates ------------------------------------------------------
function boxPath(x: number, y: number, w: number, h: number, r: number) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  if (!r) return `M${f(x)} ${f(y)}h${f(w)}v${f(h)}h${f(-w)}Z`;
  return (
    `M${f(x + r)} ${f(y)}H${f(x + w - r)}A${f(r)} ${f(r)} 0 0 1 ${f(x + w)} ${f(y + r)}V${f(y + h - r)}` +
    `A${f(r)} ${f(r)} 0 0 1 ${f(x + w - r)} ${f(y + h)}H${f(x + r)}A${f(r)} ${f(r)} 0 0 1 ${f(x)} ${f(y + h - r)}V${f(y + r)}A${f(r)} ${f(r)} 0 0 1 ${f(x + r)} ${f(y)}Z`
  );
}

export function fromDom(node: SceneNode, widths: Map<string, number>, dx = 0): RouteResult | null {
  const c = node.control;
  const [, , w, h] = node.box;
  const T = TEMPLATES.controls;
  if (!c || c.disabled) return null;
  const accent = c.accent ? rgb(c.accent) : "rgb(0, 117, 255)";
  const paint = (t: ControlTemplate) =>
    t.paths
      .map((p) => {
        const fill = p.fill ? ` fill="${p.fill.replace("ACCENT", accent)}"${p.evenodd ? ' fill-rule="evenodd"' : ""}` : ' fill="none"';
        const stroke = p.stroke ? ` stroke="${p.stroke.replace("ACCENT", accent)}" stroke-width="${p.strokeWidth}"` : "";
        return `<path d="${p.d}"${fill}${stroke}/>`;
      })
      .join("");
  if (c.type === "checkbox" || c.type === "radio") {
    const name = `${c.type}:${c.checked ? "checked" : "unchecked"}` as const;
    const t = T[name];
    if (!t) return null;
    const inner = `<g transform="scale(${f(w / t.w)} ${f(h / t.h)})">${paint(t)}</g>`;
    return { svg: local(node, inner), children: [vectorNode(node, inner, `${c.type} (template)`)], detail: { template: name } };
  }
  const st = node.style ?? {};
  let inner = "";
  // Is this the browser's default look? Text fields report an "inset" border; a
  // default <select> reports a 1 px grey border on a grey background.
  const own0 = st.fills?.[0]?.type === "solid" ? st.fills[0].color : null;
  const sw = st.strokes?.weights?.[0];
  const sc = st.strokes?.colors?.[0];
  // The default button-face grey is 239 on Linux and 240 on Windows.
  const faceGrey = !!own0 && own0[0] === own0[1] && own0[1] === own0[2] && own0[0] >= 236 && own0[0] <= 242 && own0[3] === 1;
  const native = c.uaBorder || (c.type === "select" && sw === 1 && sc?.join() === "118,118,118,1" && faceGrey);
  if (native) {
    // A browser-default field: Chrome paints its own thin rounded border, not the computed "2px inset".
    const t = T.field;
    if (!t) return null;
    // A default <select> reports a grey background but is painted white.
    const fill = own0 && !(c.type === "select" && faceGrey) ? rgb(own0) : "rgb(255, 255, 255)";
    inner += `<path d="${boxPath(0.5, 0.5, w - 1, h - 1, t.radius)}" fill="${fill}" stroke="${t.stroke}" stroke-width="1"/>`;
  } else {
    // An author-styled field: the computed style is what is painted.
    const r = st.radii ? st.radii[0] : 0;
    const bw = sw ?? 0;
    if (own0) inner += `<path d="${boxPath(0, 0, w, h, r)}" fill="${rgb(own0)}"/>`;
    if (bw && sc) inner += `<path d="${boxPath(bw / 2, bw / 2, w - bw, h - bw, Math.max(0, r - bw / 2))}" fill="none" stroke="${rgb(sc)}" stroke-width="${bw}"/>`;
  }
  if (c.type === "select") {
    const a = T.selectArrow;
    if (!a) return null;
    inner += `<g transform="translate(${f(w - (a.fromRight ?? 0))} ${f(h / 2 - a.h / 2)})">${paint(a)}</g>`;
  } else if (!/^(text|search|email|url|tel|number|textarea|button|submit|reset)$/.test(c.type)) return null;
  const out: RouteResult = { svg: local(node, inner), children: [vectorNode(node, inner, "control box (rebuilt)")], detail: { style: native ? "browser default" : "computed style" } };
  if (c.text) {
    const ft = c.font;
    const width = widths.get(node.id) ?? 0;
    const top = c.type === "textarea" ? c.content[1] : c.content[1] + (c.content[3] - (ft.ascent + ft.descent)) / 2;
    // The DOM does not say where a control puts its text. Start from the content
    // box (a default <select> adds its own inset); the caller tries small shifts.
    const inset = c.type === "select" && native ? (T.field?.selectTextInset ?? 4) : 0;
    // Button labels are centred.
    const start = /^(button|submit|reset)$/.test(c.type) ? c.content[0] + (c.content[2] - width) / 2 : c.content[0] + inset;
    const t = textPart(node, start + dx, top + ft.ascent, width);
    out.svg += t.svg;
    out.children.push(t.node);
    out.detail.textShift = dx;
  }
  return out;
}

// ---- route: traced -------------------------------------------------------------------
export function fromTrace(node: SceneNode, hires: Pixels, vw: number): RouteResult | null {
  const k = hires.width / vw;
  const [x, y, w, h] = node.box;
  const flat = quantiseLocal(hires, x * k, y * k, w * k, h * k);
  const t = flat && traceRegion(flat, 0, 0, flat.width, flat.height, k);
  if (!t) return null;
  return { svg: local(node, t.svg), children: [vectorNode(node, t.svg, "traced outlines")], detail: { colours: t.colours, loops: t.loops } };
}

/** How close a drawing is to the screenshot inside one rectangle, by brightness. */
async function score(ctx: Context, fragment: string, box: SceneNode["box"], shot: Pixels, dpr: number) {
  const [x, y, w, h] = box;
  const X = Math.round(x * dpr);
  const Y = Math.round(y * dpr);
  const W = Math.round(w * dpr);
  const H = Math.round(h * dpr);
  const want = crop(shot, X, Y, W, H);
  // The backdrop is whatever colour the page has just left of the control.
  const o = (Math.min(shot.height - 1, Math.max(0, Y + (H >> 1))) * shot.width + Math.max(0, X - 2)) * 4;
  const bg = `rgb(${shot.data[o]}, ${shot.data[o + 1]}, ${shot.data[o + 2]})`;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W / dpr}" height="${H / dpr}" viewBox="${X / dpr} ${Y / dpr} ${W / dpr} ${H / dpr}">` +
    `<rect x="${X / dpr}" y="${Y / dpr}" width="100%" height="100%" fill="${bg}"/>${fragment.replace(/ textLength="[^"]*" lengthAdjust="spacing"/g, "")}</svg>`;
  const got = await ctx.decode(await ctx.host.page(rasteriseSvg, svg, dpr));
  if (got.width !== want.width || got.height !== want.height) return { within8Pct: 0, within48Pct: 0, exactPct: 0 };
  return { within8Pct: diff(got, want, { luma: true }).tolPct, within48Pct: diff(got, want, { luma: true, tol: 48 }).tolPct, exactPct: diff(got, want).exactPct };
}

type Scene = { svg: string; meta: SceneMeta };

export const PATCH_COMBO: Combination = {
  id: "S2+patches",
  needs: ["S2"],
  what: "Turn native controls and other patches into vectors: PDF drawing → rebuilt from DOM → traced → bitmap",
  async run(ctx) {
    const s2 = outOf<S2Result>(ctx, "S2");
    const base = (ctx.out["F1+S2"] as Scene | undefined) ?? s2;
    const info = await ctx.info();
    const shot = await ctx.shot();
    const d = info.dpr;
    const meta = structuredClone(base.meta);
    const patches: [SceneNode, SceneNode][] = [];
    walkNodes(meta.root, (n, parent) => {
      if (n.kind === "patch" && parent) patches.push([n, parent]);
    });
    const s3 = ctx.out.S3 as S3Result | undefined;
    const pdf = s3?.pdf ? await parsePdfPage(s3.pdf).catch(() => null) : null;
    const hires = (ctx.out.K1 as K1Result | undefined)?.image ?? null;
    const withText = patches.filter(([n]) => n.control?.text);
    const ws = withText.length ? await ctx.host.page(measureRuns, withText.map(([n]) => [cssFont((n.control as ControlInfo).font), (n.control as ControlInfo).text ?? ""] as [string, string])) : [];
    const widths = new Map(withText.map(([n], i) => [n.id, ws[i]]));

    let added = "";
    const rows: Record<string, unknown>[] = [];
    const tally: Record<string, number> = {};
    const started = performance.now();
    for (const [index, [n, parent]] of patches.entries()) {
      const tried: Record<string, unknown>[] = [];
      let won: { route: string; r: RouteResult } | null = null;
      const unscored = index >= MAX_SCORED_PATCHES ? "not scored: over the patch limit" : performance.now() - started > PATCH_MS ? "not scored: time budget" : null;
      if (!unscored) {
        await ctx.host.ping?.();
        // The DOM route has one unknown, the text's sub-pixel start: a few are tried and the best kept.
        const shifts = n.control?.text ? [0, -0.25, 0.25, -0.5, 0.5, -0.75, 0.75, -1, 1] : [0];
        const routes: [string, () => (RouteResult | null)[]][] = [
          ["pdf", () => [pdf && fromPdf(n, pdf, [info.scrollX, info.scrollY], widths)]],
          ["dom", () => shifts.map((dx) => fromDom(n, widths, dx))],
          ["traced", () => [hires && fromTrace(n, hires, info.vw)]],
        ];
        for (const [route, make] of routes) {
          let cands: RouteResult[];
          try {
            cands = make().filter((c): c is RouteResult => !!c);
          } catch (e) {
            tried.push({ route, error: String((e as Error)?.message ?? e) });
            continue;
          }
          if (!cands.length) {
            tried.push({ route, skipped: true });
            continue;
          }
          let r = cands[0];
          let s: Awaited<ReturnType<typeof score>> | null = null;
          for (const cand of cands) {
            const sc = await score(ctx, cand.svg, n.box, shot, d);
            if (!s || sc.within8Pct > s.within8Pct) {
              s = sc;
              r = cand;
            }
            if (sc.exactPct === 100) break;
          }
          tried.push({ route, ...s, ...r.detail });
          if (s && s.within48Pct >= ACCEPT.within48Pct && s.within8Pct >= ACCEPT.within8Pct) {
            won = { route, r };
            break;
          }
        }
      }
      if (won) {
        added += won.r.svg;
        parent.children?.splice(parent.children.indexOf(n), 1, {
          id: n.id,
          kind: "frame",
          name: n.name,
          box: n.box,
          source: n.source,
          confidence: won.route,
          control: n.control,
          style: {},
          children: won.r.children,
        });
      } else {
        // Bitmap: a crop of the k× re-render when there is one, else of the screenshot.
        const src = hires ?? shot;
        const k = src.width / info.vw;
        const url = await blobToDataUrl(await ctx.encode(crop(src, n.box[0] * k, n.box[1] * k, n.box[2] * k, n.box[3] * k)));
        const key = `p${n.id}`;
        meta.assets[key] = url;
        n.patch = { reason: "unknown", ...n.patch, asset: key, scale: k };
        added += `<image data-patch="${esc(String(n.patch.reason))}" x="${n.box[0]}" y="${n.box[1]}" width="${n.box[2]}" height="${n.box[3]}" preserveAspectRatio="none" href="${url}"/>`;
      }
      const route = won ? won.route : "bitmap";
      tally[route] = (tally[route] ?? 0) + 1;
      const label = n.control ? `${n.control.type}${n.control.checked ? " (checked)" : ""}` : String(n.patch?.reason);
      rows.push({ control: label, route, tried: unscored ?? tried });
    }
    const svg = embedMeta(base.svg.replace(/<\/svg>\s*$/, () => `${added}</svg>`), meta);
    await ctx.save("scene-final.svg", svg);
    ctx.out["S2+patches"] = { svg, meta };
    const stillFlagged = s2.unsupported.filter((u) => !/form-control|video|iframe|object|embed/.test(u.why));
    const v = await verifyScene(ctx, svg, stillFlagged);
    return { patches: patches.length, routes: tally, available: { pdf: !!pdf, traced: !!hires, hiresBitmap: !!hires }, vsShot: v.whole, before: s2.report.vsShot, rows };
  },
};

