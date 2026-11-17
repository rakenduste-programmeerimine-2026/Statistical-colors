// S2 · DOM → SVG scene plus metadata. No debugger needed.
//
// One page function walks the live DOM once and builds two things together:
//   * an SVG drawing: boxes as paths, text as <text>, icons flattened, images
//     embedded, linear gradients, drop shadows and text pseudo-elements;
//   * the scene metadata (core/scene.ts) for the Figma plugin.
// The metadata goes inside the SVG, so scene.svg is one self-describing file.
// Saves scene.svg and scene-vs-shot.png (a difference map against the shot).
import { diff, rectMask, type Pixels } from "../core/img.ts";
import type { ApproachResult, Context } from "../core/pipeline.ts";
import {
  embedMeta,
  forCheck,
  walkNodes,
  type Box,
  type Fill,
  type FontUse,
  type RgbaTuple,
  type SceneMeta,
  type SceneNode,
  type TextRun,
  type Unsupported,
} from "../core/scene.ts";

/**
 * Open fonts with the same advance widths as common proprietary ones. All are
 * Google fonts, which Figma has on every machine.
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

export interface SceneCounts {
  boxes: number;
  images: number;
  inlineSvgs: number;
  gradients: number;
  shadows: number;
  pseudo: number;
  patches: number;
  textRuns: number;
  embeddedFonts: number;
  nodes: number;
}

export interface DomScene {
  svg: string;
  meta: SceneMeta;
  unsupported: Unsupported[];
  palette: string[];
  texts: TextRun[];
  counts: SceneCounts;
}

// ---- runs inside the page: self-contained, see core/page-fns.ts -------------
export async function domToSvg(ignoreSelector: string | null, substitutes: Record<string, string>): Promise<DomScene> {
  type Rect = { left: number; top: number; right: number; bottom: number; width: number; height: number };
  type Anchor = { rect: Rect; baseline: number };
  type Out = { svg: string; node: SceneNode };
  const vw = innerWidth;
  const vh = innerHeight;
  const unsupported: Unsupported[] = [];
  const palette = new Set<string>();
  const texts: TextRun[] = [];
  const defs: string[] = [];
  const assets: Record<string, string> = {};
  const fontUse = new Map<string, FontUse>();
  let uid = 0;
  let nid = 0;
  let nAsset = 0;
  const count = { boxes: 0, images: 0, inlineSvgs: 0, gradients: 0, shadows: 0, pseudo: 0, patches: 0 };
  const esc = (s: unknown) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const f = (v: number | string) => +(+v).toFixed(3);
  const num = (s: string) => parseFloat(s) || 0;
  const prop = (cs: CSSStyleDeclaration, name: string) => cs.getPropertyValue(name);
  const SIDES = ["top", "right", "bottom", "left"] as const;
  const CORNERS = ["top-left", "top-right", "bottom-right", "bottom-left"] as const;
  // The browser snaps box and image edges to device pixels; text is not snapped.
  const dpr = devicePixelRatio;
  const px = (v: number) => Math.round(v * dpr) / dpr;
  const snapRect = (r: DOMRect | Rect): Rect => {
    const left = px(r.left);
    const top = px(r.top);
    const right = px(r.right);
    const bottom = px(r.bottom);
    return { left, top, right, bottom, width: right - left, height: bottom - top };
  };
  const seen = (c: string | null | undefined) => (c && c !== "rgba(0, 0, 0, 0)" && c !== "transparent" ? (palette.add(c), c) : null);
  const onScreen = (r: Rect) => r.width > 0 && r.height > 0 && r.right > 0 && r.bottom > 0 && r.left < vw && r.top < vh;
  const flag = (why: string, r: Rect, extra: Partial<Unsupported> = {}) =>
    unsupported.push({ why, x: f(r.left), y: f(r.top), w: f(r.width), h: f(r.height), ...extra });
  const rgba = (c: string | null | undefined): RgbaTuple | null => {
    const m = c?.match(/^rgba?\(([^)]+)\)$/);
    if (!m) return null;
    const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
    return [p[0], p[1], p[2], p[3] === undefined ? 1 : p[3]];
  };
  const mk = (kind: SceneNode["kind"], name: string, r: Pick<Rect, "left" | "top" | "width" | "height">, extra: Partial<SceneNode> = {}): SceneNode => ({
    id: `n${nid++}`,
    kind,
    name,
    box: [f(r.left), f(r.top), f(r.width), f(r.height)],
    ...extra,
  });
  // Splits on commas that are not inside parentheses.
  const splitTop = (s: string) => {
    const out: string[] = [];
    let depth = 0;
    let cur = "";
    for (const ch of s) {
      if (ch === "(") depth++;
      if (ch === ")") depth--;
      if (ch === "," && !depth) {
        out.push(cur.trim());
        cur = "";
      } else cur += ch;
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
  };

  const mctx = document.createElement("canvas").getContext("2d");
  if (!mctx) throw new Error("Canvas 2D is not available in this page.");
  const metricCache = new Map<string, { asc: number; desc: number }>();
  const fontOf = (cs: CSSStyleDeclaration, family?: string) => `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${family || cs.fontFamily}`;
  const metrics = (cs: CSSStyleDeclaration) => {
    const font = fontOf(cs);
    let m = metricCache.get(font);
    if (!m) {
      mctx.font = font;
      const t = mctx.measureText("Hg");
      m = { asc: t.fontBoundingBoxAscent, desc: t.fontBoundingBoxDescent };
      metricCache.set(font, m);
    }
    return m;
  };
  // Is a family really available here (installed or a loaded web font)?
  const GEN = ["monospace", "serif", "sans-serif"];
  const PROBE = "mmmmmmmmmmlli@#Wj";
  const probeW = (font: string) => {
    mctx.font = `72px ${font}`;
    return mctx.measureText(PROBE).width;
  };
  const baseW = GEN.map(probeW);
  const availCache = new Map<string, boolean>();
  const isGeneric = (fam: string) => /^(serif|sans-serif|monospace|system-ui|cursive|fantasy|ui-[a-z-]+|-apple-system|BlinkMacSystemFont)$/i.test(fam);
  const available = (fam: string) => {
    if (!availCache.has(fam)) availCache.set(fam, GEN.some((g, i) => probeW(`"${fam}", ${g}`) !== baseW[i]));
    return availCache.get(fam) as boolean;
  };
  // The first family in the CSS list that really is available. A missing font
  // renders in the next one, so the requested name alone would mislead.
  const famCache = new Map<string, string>();
  const usedFamily = (list: string) => {
    let used = famCache.get(list);
    if (used) return used;
    used = "sans-serif";
    for (const raw of list.split(",")) {
      const fam = raw.trim().replace(/^["']|["']$/g, "");
      if (isGeneric(fam) || available(fam)) {
        used = fam;
        break;
      }
    }
    famCache.set(list, used);
    return used;
  };
  const genericOf = (list: string) =>
    list
      .split(",")
      .map((s) => s.trim())
      .reverse()
      .find(isGeneric) || "sans-serif";
  // The substitute for a family, checked against this run's own width when it is installed here.
  const substituteFor = (cs: CSSStyleDeclaration, used: string, str: string, width: number) => {
    const sub = substitutes[used.toLowerCase()] ?? null;
    const key = `${used}|${sub ?? ""}`;
    let rec = fontUse.get(key);
    if (!rec) {
      rec = { used, substitute: sub, runs: 0, checked: 0, maxWidthDelta: 0, substituteAvailableHere: sub ? available(sub) : false };
      fontUse.set(key, rec);
    }
    rec.runs++;
    if (sub && rec.substituteAvailableHere) {
      mctx.font = fontOf(cs, `"${sub}"`);
      const d = Math.abs(mctx.measureText(str).width - width);
      rec.checked++;
      if (d > rec.maxWidthDelta) rec.maxWidthDelta = +d.toFixed(3);
    }
    return sub;
  };
  const dataUrl = async (url: string | null) => {
    if (!url || url.startsWith("data:")) return url;
    try {
      const blob = await (await fetch(url, { mode: "cors" })).blob();
      return await new Promise<string>((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => res(fr.result as string);
        fr.onerror = rej;
        fr.readAsDataURL(blob);
      });
    } catch {
      return url;
    }
  };
  // A rounded-rectangle path; radii are top-left, top-right, bottom-right, bottom-left.
  const boxPath = (x: number, y: number, w: number, h: number, rad: number[]) => {
    const m = Math.min(w, h) / 2;
    const [a, b, c, d] = rad.map((r) => Math.max(0, Math.min(r, m)));
    if (!(a || b || c || d)) return `M${f(x)} ${f(y)}h${f(w)}v${f(h)}h${f(-w)}z`;
    return (
      `M${f(x + a)} ${f(y)}H${f(x + w - b)}A${f(b)} ${f(b)} 0 0 1 ${f(x + w)} ${f(y + b)}V${f(y + h - c)}` +
      `A${f(c)} ${f(c)} 0 0 1 ${f(x + w - c)} ${f(y + h)}H${f(x + d)}A${f(d)} ${f(d)} 0 0 1 ${f(x)} ${f(y + h - d)}` +
      `V${f(y + a)}A${f(a)} ${f(a)} 0 0 1 ${f(x + a)} ${f(y)}z`
    );
  };
  const radii = (cs: CSSStyleDeclaration) => CORNERS.map((k) => num(prop(cs, `border-${k}-radius`)));

  // "rgba(0, 0, 0, 0.25) 0px 4px 14px 0px [inset], …" → one entry per shadow.
  const parseShadows = (str: string) => {
    if (!str || str === "none") return [];
    return splitTop(str).flatMap((part) => {
      const col = part.match(/rgba?\([^)]+\)/);
      const n = (part.replace(/rgba?\([^)]+\)/, "").match(/-?[\d.]+px/g) ?? []).map(parseFloat);
      return col && n.length >= 2 ? [{ inset: /\binset\b/.test(part), x: n[0], y: n[1], blur: n[2] || 0, spread: n[3] || 0, color: rgba(col[0]) }] : [];
    });
  };
  // One linear-gradient layer → angle in CSS degrees and stops at 0..1, or null.
  const parseGradient = (str: string, w: number, h: number) => {
    const layers = splitTop(str);
    const m = layers.length === 1 && layers[0].match(/^linear-gradient\(([\s\S]*)\)$/);
    if (!m) return null;
    const parts = splitTop(m[1]);
    let angle = 180;
    const dirs: Record<string, number> = { "to top": 0, "to right": 90, "to bottom": 180, "to left": 270 };
    if (/^-?[\d.]+deg$/.test(parts[0])) angle = parseFloat(parts.shift() as string);
    else if (/^to /.test(parts[0])) {
      const d = parts.shift() as string;
      if (!(d in dirs)) return null;
      angle = dirs[d];
    }
    const rad = (angle * Math.PI) / 180;
    const len = Math.abs(w * Math.sin(rad)) + Math.abs(h * Math.cos(rad));
    const stops = parts.map((p) => {
      const col = p.match(/rgba?\([^)]+\)/);
      if (!col) return null;
      const pos = p.replace(col[0], "").trim();
      return { color: rgba(col[0]), pos: /%$/.test(pos) ? parseFloat(pos) / 100 : /px$/.test(pos) ? parseFloat(pos) / len : null };
    });
    if (stops.length < 2 || stops.some((s) => !s)) return null;
    const placed = stops as { color: RgbaTuple | null; pos: number | null }[];
    if (placed[0].pos === null) placed[0].pos = 0;
    if (placed[placed.length - 1].pos === null) placed[placed.length - 1].pos = 1;
    // Unplaced stops are spread evenly between their placed neighbours.
    for (let i = 1; i < placed.length - 1; i++) {
      if (placed[i].pos !== null) continue;
      let j = i;
      while (placed[j].pos === null) j++;
      const from = placed[i - 1].pos as number;
      const to = placed[j].pos as number;
      for (let k = i; k < j; k++) placed[k].pos = from + ((to - from) * (k - i + 1)) / (j - i + 1);
    }
    return { angle, stops: placed.map((s) => ({ pos: +(s.pos as number).toFixed(4), color: s.color })) };
  };
  const cssCol = (c: RgbaTuple | null) => (c ? `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${c[3]})` : "none");

  // One line of text → SVG element + metadata node.
  const textOut = (str: string, rect: Rect, baseline: number, cs: CSSStyleDeclaration, fill: string, extra: Partial<SceneNode> = {}): Out => {
    const used = usedFamily(cs.fontFamily);
    const sub = substituteFor(cs, used, str, rect.width);
    const fam = [used, sub, genericOf(cs.fontFamily)]
      .filter((v, i, a): v is string => !!v && a.indexOf(v) === i)
      .map((v) => (isGeneric(v) ? v : `'${v}'`))
      .join(", ");
    const deco = cs.textDecorationLine !== "none" ? ` text-decoration="${esc(cs.textDecorationLine)}"` : "";
    // textLength pins the run to its measured width, so a viewer without the
    // font cannot push it into its neighbour. The pixel check removes it again.
    const svg =
      `<text x="${f(rect.left)}" y="${f(baseline)}" font-family="${esc(fam)}" font-size="${f(parseFloat(cs.fontSize))}" ` +
      `font-weight="${esc(cs.fontWeight)}"${cs.fontStyle !== "normal" ? ` font-style="${esc(cs.fontStyle)}"` : ""} fill="${esc(fill)}"${deco} ` +
      `textLength="${f(rect.width)}" lengthAdjust="spacing" xml:space="preserve">${esc(str)}</text>`;
    const node = mk("text", str.slice(0, 40), rect, {
      ...extra,
      text: {
        characters: str,
        usedFamily: used,
        substitute: sub,
        requested: cs.fontFamily.split(",").map((s) => s.trim().replace(/^["']|["']$/g, "")),
        weight: +cs.fontWeight || 400,
        italic: cs.fontStyle !== "normal",
        size: parseFloat(cs.fontSize),
        lineHeight: f(rect.height),
        letterSpacing: parseFloat(cs.letterSpacing) || 0,
        decoration: cs.textDecorationLine,
        fill: rgba(fill),
        baseline: f(baseline),
        width: f(rect.width),
      },
    });
    texts.push({
      text: str,
      x: f(rect.left),
      y: f(rect.top),
      w: f(rect.width),
      h: f(rect.height),
      baseline: f(baseline),
      family: cs.fontFamily,
      usedFamily: used,
      size: parseFloat(cs.fontSize),
      weight: cs.fontWeight,
      style: cs.fontStyle,
      color: fill,
      pseudo: extra.pseudo,
    });
    return { svg, node };
  };

  const emitText = (node: Text, cs: CSSStyleDeclaration) => {
    const raw = node.data;
    const out = { svg: "", nodes: [] as SceneNode[], first: null as Anchor | null, last: null as Anchor | null };
    if (!raw.trim()) return out;
    const fill = seen(cs.webkitTextFillColor) || seen(cs.color);
    if (!fill) return out;
    const range = document.createRange();
    const words: { s: number; e: number; r: DOMRect }[] = [];
    for (const m of raw.matchAll(/\S+/g)) {
      const at = m.index ?? 0;
      range.setStart(node, at);
      range.setEnd(node, at + m[0].length);
      const rs = range.getClientRects();
      if (rs.length === 1) words.push({ s: at, e: at + m[0].length, r: rs[0] });
      else {
        // The word wraps across lines: measure it character by character.
        for (let i = at; i < at + m[0].length; i++) {
          range.setStart(node, i);
          range.setEnd(node, i + 1);
          const r = range.getClientRects()[0];
          if (r) words.push({ s: i, e: i + 1, r });
        }
      }
    }
    const lines: { s: number; e: number; left: number; right: number; top: number; height: number }[] = [];
    for (const w of words) {
      const last = lines[lines.length - 1];
      if (last && Math.abs(last.top - w.r.top) < 1 && w.r.left >= last.right - 1) {
        last.e = w.e;
        last.right = w.r.right;
      } else lines.push({ s: w.s, e: w.e, left: w.r.left, right: w.r.right, top: w.r.top, height: w.r.height });
    }
    const m = metrics(cs);
    const tt = cs.textTransform;
    for (const l of lines) {
      const rect = { left: l.left, top: l.top, right: l.right, bottom: l.top + l.height, width: l.right - l.left, height: l.height };
      const anchor = { rect, baseline: l.top + l.height * (m.asc / (m.asc + m.desc)) };
      if (!out.first) out.first = anchor;
      out.last = anchor;
      if (!onScreen(rect)) continue;
      let str = raw.slice(l.s, l.e);
      if (!/pre/.test(cs.whiteSpace)) str = str.replace(/\s+/g, " ");
      if (tt === "uppercase") str = str.toUpperCase();
      else if (tt === "lowercase") str = str.toLowerCase();
      else if (tt === "capitalize") str = str.replace(/(^|\s)\S/g, (c) => c.toUpperCase());
      const t = textOut(str, rect, anchor.baseline, cs, fill);
      out.svg += t.svg;
      out.nodes.push(t.node);
    }
    return out;
  };

  // A text pseudo-element. The DOM gives its string and style but not its box,
  // so the box is measured: ::before ends where the element's first text
  // starts, ::after starts where its last text ends. Marked "measured".
  const pseudoOut = (el: Element, which: "::before" | "::after", anchor: Anchor | null, contentEdge: number, r: Rect): Out | null => {
    const ps = getComputedStyle(el, which);
    const c = ps.content;
    if (!c || c === "none" || c === "normal") return null;
    const m = c.match(/^"((?:[^"\\]|\\.)*)"$/);
    const inline = ps.display === "inline" && (ps.position === "static" || ps.position === "relative") && ps.backgroundImage === "none";
    const fill = seen(ps.webkitTextFillColor) || seen(ps.color);
    if (!m || !inline || !fill) {
      flag("pseudo-element", r);
      return null;
    }
    const str = m[1].replace(/\\(.)/g, "$1");
    if (!str.trim()) return null;
    mctx.font = fontOf(ps);
    const w = mctx.measureText(str).width;
    const fm = metrics(ps);
    const h = fm.asc + fm.desc;
    const left = anchor ? (which === "::before" ? anchor.rect.left - w : anchor.rect.right) : contentEdge;
    const baseline = anchor ? anchor.baseline : r.top + (r.height - h) / 2 + fm.asc;
    // Leading and trailing spaces carry no ink, so they are trimmed from the pinned width.
    const lead = str.length - str.trimStart().length;
    const inkLeft = left + mctx.measureText(str.slice(0, lead)).width;
    const inkW = mctx.measureText(str.trim()).width;
    count.pseudo++;
    const rect = { left: inkLeft, top: baseline - fm.asc, right: inkLeft + inkW, bottom: baseline + fm.desc, width: inkW, height: h };
    return textOut(str.trim(), rect, baseline, ps, fill, { pseudo: which, confidence: "measured" });
  };

  const classesOf = (el: Element) => (typeof el.className === "string" && el.className.trim() ? el.className.trim().split(/\s+/) : undefined);
  const nameOf = (el: Element) => {
    const label = el.getAttribute("aria-label") || el.getAttribute("data-testid");
    const cls = classesOf(el);
    return label || `${el.localName}${el.id ? `#${el.id}` : ""}${cls ? `.${cls.slice(0, 3).join(".")}` : ""}`;
  };
  const sourceOf = (el: Element) => ({
    tag: el.localName,
    id: el.id || undefined,
    classes: classesOf(el),
    role: el.getAttribute("role") || undefined,
    label: el.getAttribute("aria-label") || undefined,
    testid: el.getAttribute("data-testid") || undefined,
  });

  const emit = async (el: Element, deferred: Element[]): Promise<Out | null> => {
    if (ignoreSelector && el.matches(ignoreSelector)) return null;
    const cs = getComputedStyle(el);
    if (cs.display === "none") return null;
    const r = snapRect(el.getBoundingClientRect());
    const tag = el.localName;
    const hidden = cs.visibility !== "visible";
    const show = onScreen(r) && !hidden;
    const isRoot = tag === "html" || tag === "body";
    const node = mk("frame", nameOf(el), tag === "html" ? { left: 0, top: 0, width: vw, height: vh } : r, { source: sourceOf(el), style: {}, children: [] });
    const st = node.style as NonNullable<SceneNode["style"]>;
    let out = "";

    if (cs.transform !== "none" && !/^matrix\(1, 0, 0, 1,/.test(cs.transform)) flag("transform", r);
    const backdrop = prop(cs, "backdrop-filter");
    if (cs.filter !== "none" || cs.mixBlendMode !== "normal" || (backdrop && backdrop !== "none")) flag("filter-or-blend", r);

    const rad = radii(cs);
    if (show && !isRoot) {
      const bg = seen(cs.backgroundColor);
      if (rad.some(Boolean)) st.radii = rad.map(f);
      // Shadows first: they sit behind the box.
      for (const s of parseShadows(cs.boxShadow)) {
        (st.effects ??= []).push({ type: s.inset ? "inner-shadow" : "drop-shadow", x: s.x, y: s.y, blur: s.blur, spread: s.spread, color: s.color });
        count.shadows++;
        if (s.inset) {
          // Figma has inner shadows natively; this SVG does not draw them.
          flag("inset-shadow", r, { svgOnly: true });
          continue;
        }
        const id = `fs-blur-${uid++}`;
        const e = s.blur * 1.5 + 2;
        const bx = r.left + s.x - s.spread;
        const by = r.top + s.y - s.spread;
        const bw2 = r.width + 2 * s.spread;
        const bh2 = r.height + 2 * s.spread;
        defs.push(
          `<filter id="${id}" filterUnits="userSpaceOnUse" x="${f(bx - e)}" y="${f(by - e)}" width="${f(bw2 + 2 * e)}" height="${f(bh2 + 2 * e)}">` +
            `<feGaussianBlur stdDeviation="${f(s.blur / 2)}"/></filter>`,
        );
        out += `<path d="${boxPath(bx, by, bw2, bh2, rad.map((x) => (x ? x + s.spread : 0)))}" fill="${cssCol(s.color)}" filter="url(#${id})"/>`;
      }
      // Background colour, then gradient.
      if (bg) {
        out += `<path d="${boxPath(r.left, r.top, r.width, r.height, rad)}" fill="${esc(bg)}"/>`;
        count.boxes++;
        (st.fills ??= []).push({ type: "solid", color: rgba(bg) });
      }
      if (cs.backgroundImage !== "none") {
        const g = parseGradient(cs.backgroundImage, r.width, r.height);
        if (g) {
          const id = `fs-grad-${uid++}`;
          const a = (g.angle * Math.PI) / 180;
          const dx = Math.sin(a);
          const dy = -Math.cos(a);
          const len = Math.abs(r.width * dx) + Math.abs(r.height * dy);
          const cx = r.left + r.width / 2;
          const cy = r.top + r.height / 2;
          const stops = g.stops
            .map((s) => {
              const c = s.color ?? [0, 0, 0, 0];
              return `<stop offset="${s.pos}" stop-color="rgb(${c[0]}, ${c[1]}, ${c[2]})"${c[3] < 1 ? ` stop-opacity="${c[3]}"` : ""}/>`;
            })
            .join("");
          defs.push(
            `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${f(cx - (dx * len) / 2)}" y1="${f(cy - (dy * len) / 2)}" ` +
              `x2="${f(cx + (dx * len) / 2)}" y2="${f(cy + (dy * len) / 2)}">${stops}</linearGradient>`,
          );
          out += `<path d="${boxPath(r.left, r.top, r.width, r.height, rad)}" fill="url(#${id})"/>`;
          (st.fills ??= []).push({ type: "linear", angle: g.angle, stops: g.stops } as Fill);
          count.gradients++;
        } else flag("background-image", r);
      }
      // Borders.
      const bw = SIDES.map((k) => (prop(cs, `border-${k}-style`) === "none" ? 0 : num(prop(cs, `border-${k}-width`))));
      const bc = SIDES.map((k) => prop(cs, `border-${k}-color`));
      if (bw.some(Boolean)) {
        const uniform = bw.every((w) => w === bw[0]) && bc.every((c) => c === bc[0]);
        if (SIDES.some((k, i) => bw[i] && prop(cs, `border-${k}-style`) !== "solid")) flag("border-style", r);
        st.strokes = { weights: bw.map(f), colors: bc.map((c, i) => (bw[i] ? rgba(c) : null)), uniform };
        if (uniform && seen(bc[0])) {
          // As the browser draws it: the outer rounded box minus the inner one.
          const w = bw[0];
          const inner = boxPath(r.left + w, r.top + w, r.width - 2 * w, r.height - 2 * w, rad.map((x) => Math.max(0, x - w)));
          out += `<path fill-rule="evenodd" d="${boxPath(r.left, r.top, r.width, r.height, rad)}${inner}" fill="${esc(bc[0])}"/>`;
          count.boxes++;
        } else {
          if (rad.some(Boolean)) flag("mixed-border-with-radius", r);
          const strips = [
            [r.left, r.top, r.width, bw[0]],
            [r.right - bw[1], r.top, bw[1], r.height],
            [r.left, r.bottom - bw[2], r.width, bw[2]],
            [r.left, r.top, bw[3], r.height],
          ];
          strips.forEach(([x, y, w, h], i) => {
            if (!bw[i] || !seen(bc[i])) return;
            out += `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" fill="${esc(bc[i])}"/>`;
            count.boxes++;
          });
        }
      }
      if (/flex/.test(cs.display)) {
        node.layout = {
          mode: /column/.test(cs.flexDirection) ? "column" : "row",
          gap: num(cs.columnGap) || num(cs.rowGap),
          padding: SIDES.map((k) => num(prop(cs, `padding-${k}`))),
          align: cs.alignItems,
          justify: cs.justifyContent,
          wrap: cs.flexWrap !== "nowrap",
        };
      }
    }

    // The content box, for replaced elements.
    const pl = num(cs.paddingLeft) + num(cs.borderLeftWidth);
    const pt = num(cs.paddingTop) + num(cs.borderTopWidth);
    const cw = r.width - pl - num(cs.paddingRight) - num(cs.borderRightWidth);
    const ch = r.height - pt - num(cs.paddingBottom) - num(cs.borderBottomWidth);
    const content = { left: r.left + pl, top: r.top + pt, right: r.left + pl + cw, bottom: r.top + pt + ch, width: cw, height: ch };
    const contentBox: Box = [f(content.left), f(content.top), f(cw), f(ch)];
    const leaf = (kind: SceneNode["kind"], extra: Partial<SceneNode>): Out => {
      Object.assign(node, { kind, box: contentBox, ...extra });
      delete node.children;
      return { svg: out, node };
    };

    if (el instanceof HTMLImageElement || el instanceof HTMLCanvasElement) {
      if (!show) return null;
      let href: string | null = null;
      if (el instanceof HTMLImageElement) href = await dataUrl(el.currentSrc || el.src);
      else {
        try {
          href = el.toDataURL();
        } catch {
          flag("tainted-canvas", r);
        }
      }
      if (el instanceof HTMLImageElement && cs.objectFit !== "fill") flag("object-fit", r);
      if (!href || !href.startsWith("data:")) {
        count.patches++;
        return leaf("patch", { patch: { reason: `unreadable-${tag}` } });
      }
      const key = `a${nAsset++}`;
      assets[key] = href;
      count.images++;
      out += `<image data-raster-source="${tag}" x="${f(content.left)}" y="${f(content.top)}" width="${f(cw)}" height="${f(ch)}" preserveAspectRatio="none" href="${esc(href)}"/>`;
      const backing: [number, number] = el instanceof HTMLCanvasElement ? [el.width, el.height] : [el.naturalWidth, el.naturalHeight];
      return leaf("image", { image: { asset: key, backing } });
    }
    if (el instanceof SVGSVGElement) {
      if (!show) return null;
      const clone = el.cloneNode(true) as SVGSVGElement;
      const src = [...el.querySelectorAll("*")];
      const dst = [...clone.querySelectorAll("*")];
      src.forEach((s, i) => {
        const c = getComputedStyle(s);
        if (s instanceof SVGGeometryElement || s.localName === "text") {
          dst[i].setAttribute("fill", c.fill);
          dst[i].setAttribute("stroke", c.stroke);
          dst[i].setAttribute("stroke-width", String(parseFloat(c.strokeWidth)));
          seen(c.fill);
          seen(c.stroke);
        }
        dst[i].removeAttribute("class");
        dst[i].removeAttribute("style");
      });
      const inner = [...clone.childNodes].map((n) => new XMLSerializer().serializeToString(n)).join("");
      // Flattened: the nested <svg> becomes a group with the same transform.
      const vbv = el.viewBox.baseVal;
      const vb = vbv && vbv.width > 0 ? vbv : { x: 0, y: 0, width: cw, height: ch };
      const none = el.preserveAspectRatio.baseVal.align === SVGPreserveAspectRatio.SVG_PRESERVEASPECTRATIO_NONE;
      let sx = cw / vb.width;
      let sy = ch / vb.height;
      if (!none) sx = sy = Math.min(sx, sy);
      const ox = content.left + (cw - vb.width * sx) / 2;
      const oy = content.top + (ch - vb.height * sy) / 2;
      out += `<g transform="translate(${f(ox)} ${f(oy)}) scale(${f(sx)} ${f(sy)}) translate(${f(-vb.x)} ${f(-vb.y)})">${inner}</g>`;
      count.inlineSvgs++;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${f(cw)}" height="${f(ch)}" viewBox="${f(vb.x)} ${f(vb.y)} ${f(vb.width)} ${f(vb.height)}">${inner}</svg>`;
      return leaf("vector", { vector: { svg } });
    }
    // A <button> still in the browser's default style is native art too; a styled one is an ordinary box.
    const nativeButton = tag === "button" && /inset|outset/.test(cs.borderTopStyle);
    if (nativeButton || /^(video|iframe|object|embed|input|textarea|select|progress|meter)$/.test(tag)) {
      if (!show) return null;
      // Native controls and embedded content have no vector form: the plugin
      // cuts this rectangle out of the lossless screenshot instead.
      flag(/input|textarea|select|progress|meter|button/.test(tag) ? "form-control" : tag, r);
      count.patches++;
      const input = el instanceof HTMLInputElement ? el : null;
      const type = input ? input.type || "text" : tag;
      const textual = tag === "select" || tag === "textarea" || (input !== null && /^(text|search|email|url|tel|number|button|submit|reset)$/.test(type));
      let shown: string | null = null;
      if (el instanceof HTMLSelectElement) shown = el.selectedOptions[0]?.text ?? null;
      else if (tag === "button") shown = el.childElementCount ? null : (el.textContent ?? "").trim().replace(/\s+/g, " ") || null;
      else if (textual && (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) && !/\n/.test(el.value)) shown = el.value || null;
      const fm = metrics(cs);
      Object.assign(node, {
        kind: "patch",
        patch: { reason: tag },
        control: {
          type,
          checked: input ? input.checked : undefined,
          disabled: "disabled" in el ? Boolean((el as HTMLInputElement).disabled) : false,
          text: shown ? shown.slice(0, 200) : null,
          uaBorder: /inset|outset/.test(cs.borderTopStyle),
          color: rgba(cs.color),
          accent: rgba(cs.accentColor) || null,
          font: { usedFamily: usedFamily(cs.fontFamily), size: parseFloat(cs.fontSize), weight: +cs.fontWeight || 400, italic: cs.fontStyle !== "normal", ascent: f(fm.asc), descent: f(fm.desc) },
          content: contentBox,
        },
      });
      delete node.children;
      return { svg: "", node };
    }

    let inner = "";
    let firstText: Anchor | null = null;
    let lastText: Anchor | null = null;
    const kids: SceneNode[] = [];
    for (const child of el.childNodes) {
      if (child instanceof Text) {
        if (hidden) continue;
        const t = emitText(child, cs);
        inner += t.svg;
        kids.push(...t.nodes);
        if (t.first && !firstText) firstText = t.first;
        if (t.last) lastText = t.last;
      } else if (child instanceof Element) {
        const pos = getComputedStyle(child).position;
        if (pos === "fixed" || pos === "absolute" || pos === "sticky") deferred.push(child);
        else {
          const c = await emit(child, deferred);
          if (c) {
            inner += c.svg;
            kids.push(c.node);
          }
        }
      }
    }
    if (show && !isRoot) {
      const before = pseudoOut(el, "::before", firstText, content.left, r);
      const after = pseudoOut(el, "::after", lastText, content.right, r);
      if (before) {
        inner = before.svg + inner;
        kids.unshift(before.node);
      }
      if (after) {
        inner += after.svg;
        kids.push(after.node);
      }
    }
    node.children = kids;
    if (inner && !isRoot && (cs.overflowX !== "visible" || cs.overflowY !== "visible")) {
      const id = `fs-clip-${uid++}`;
      const bl = num(cs.borderLeftWidth);
      const bt = num(cs.borderTopWidth);
      defs.push(`<clipPath id="${id}"><path d="${boxPath(r.left + bl, r.top + bt, el.clientWidth, el.clientHeight, rad.map((x) => Math.max(0, x - bl)))}"/></clipPath>`);
      inner = `<g clip-path="url(#${id})">${inner}</g>`;
      st.clip = true;
    }
    out += inner;
    if (+cs.opacity < 1) {
      st.opacity = +cs.opacity;
      if (out) out = `<g opacity="${cs.opacity}">${out}</g>`;
    }
    // Wrappers that draw nothing and hold nothing are left out.
    if (!out && !kids.length) return null;
    return { svg: out, node };
  };

  // The page backdrop: the body colour fills the viewport when <html> has none.
  const rootBg = seen(getComputedStyle(document.documentElement).backgroundColor) || seen(getComputedStyle(document.body).backgroundColor) || "rgb(255, 255, 255)";
  palette.add(rootBg);
  const deferred: Element[] = [];
  const top = await emit(document.documentElement, deferred);
  const root = top ? top.node : mk("frame", "html", { left: 0, top: 0, width: vw, height: vh }, { style: {}, children: [] });
  root.style = { ...root.style, fills: [{ type: "solid", color: rgba(rootBg) }], clip: true };
  root.children ??= [];
  let body = `<rect width="${vw}" height="${vh}" fill="${esc(rootBg)}"/>${top ? top.svg : ""}`;
  // Positioned elements paint above normal flow, ordered by z-index.
  while (deferred.length) {
    const batch = deferred
      .splice(0, deferred.length)
      .map((el, n) => ({ el, n, z: parseInt(getComputedStyle(el).zIndex, 10) || 0 }))
      .sort((a, b) => a.z - b.z || a.n - b.n);
    for (const { el } of batch) {
      const c = await emit(el, deferred);
      if (c) {
        body += c.svg;
        root.children.push(c.node);
      }
    }
  }

  // Web fonts must travel inside the SVG, or it renders in a fallback face.
  let fontCss = "";
  for (const sheet of document.styleSheets) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue; // a cross-origin sheet without CORS
    }
    for (const rule of rules) {
      if (!(rule instanceof CSSFontFaceRule)) continue;
      let css = rule.cssText;
      for (const m of [...css.matchAll(/url\(\s*(['"]?)(?!data:)([^'")]+)\1\s*\)/g)]) {
        css = css.replace(m[0], `url("${await dataUrl(new URL(m[2], sheet.href || location.href).href)}")`);
      }
      fontCss += `${css}\n`;
    }
  }
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${vw}" height="${vh}" viewBox="0 0 ${vw} ${vh}">` +
    `<defs>${fontCss ? `<style>${esc(fontCss)}</style>` : ""}${defs.join("")}</defs>${body}</svg>`;
  const meta: SceneMeta = { version: 1, viewport: [vw, vh], dpr, url: location.href, shot: "shot.png", fonts: [...fontUse.values()], root, assets, unsupported };
  return {
    svg,
    meta,
    unsupported,
    palette: [...palette],
    texts,
    counts: { ...count, textRuns: texts.length, embeddedFonts: (fontCss.match(/@font-face/g) ?? []).length, nodes: nid },
  };
}

/** Draws an SVG with this browser's own renderer and returns a PNG data URL. Runs inside the page. */
export async function rasteriseSvg(svg: string, scale: number): Promise<string> {
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await img.decode();
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * scale);
  c.height = Math.round(img.height * scale);
  c.getContext("2d")?.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/png");
}
// ------------------------------------------------------------------------------

/**
 * The acceptance test: draw a scene at native scale and compare it with the
 * lossless shot, on the whole image and on the supported area only.
 */
export async function verifyScene(ctx: Context, svg: string, unsupported: Unsupported[]) {
  const info = await ctx.info();
  const shot = await ctx.shot();
  const raster = await ctx.decode(await ctx.host.page(rasteriseSvg, forCheck(svg), info.dpr));
  const all = diff(raster, shot, { heat: true });
  const grown = unsupported.map((u) => ({ x: u.x - (u.pad ?? 0), y: u.y - (u.pad ?? 0), w: u.w + 2 * (u.pad ?? 0), h: u.h + 2 * (u.pad ?? 0) }));
  const mask = rectMask(shot.width, shot.height, grown, info.dpr);
  const supported = diff(raster, shot, { mask });
  // An SVG drawn into an image gets grey text smoothing. Where the screen uses
  // subpixel smoothing the colours can never match, so brightness alone is
  // scored too, strictly (±8) and loosely (±48 of 255).
  const b8 = diff(raster, shot, { mask, luma: true });
  const b48 = diff(raster, shot, { mask, luma: true, tol: 48 });
  return {
    raster,
    heat: all.heat ?? null,
    mask,
    whole: { exactPct: all.exactPct, tolPct: all.tolPct, maxDiff: all.maxDiff },
    supportedOnly: { exactPct: supported.exactPct, tolPct: supported.tolPct, areaPct: Math.round((supported.compared / (shot.width * shot.height)) * 1e4) / 100 },
    supportedOnlyBrightness: { within8Pct: b8.tolPct, within48Pct: b48.tolPct },
  };
}

export type S2Result = ApproachResult &
  DomScene & {
    raster: Pixels;
    verifyMask: Uint8Array;
    report: { textRuns: number; boxes: number; vsShot: Record<string, number> } & Record<string, unknown>;
  };

export const S2 = {
  id: "S2",
  title: "DOM → SVG scene",
  needsDebugger: false,
  async run(ctx: Context): Promise<S2Result> {
    const scene = await ctx.host.page(domToSvg, ctx.opts.ignoreSelector ?? null, { ...SUBSTITUTES, ...ctx.opts.substitutes });
    scene.meta.env = ctx.opts.env ?? null;
    scene.svg = embedMeta(scene.svg, scene.meta);
    await ctx.save("scene.svg", scene.svg);
    const v = await verifyScene(ctx, scene.svg, scene.unsupported);
    if (v.heat) await ctx.save("scene-vs-shot.png", v.heat);
    const why: Record<string, number> = {};
    const kinds: Record<string, number> = {};
    for (const u of scene.unsupported) why[u.why] = (why[u.why] ?? 0) + 1;
    walkNodes(scene.meta.root, (n) => {
      kinds[n.kind] = (kinds[n.kind] ?? 0) + 1;
    });
    return {
      ...scene,
      raster: v.raster,
      verifyMask: v.mask,
      report: {
        ...scene.counts,
        metadataNodes: kinds,
        declaredColours: scene.palette.length,
        unsupported: why,
        vsShot: v.whole,
        vsShotSupportedAreaOnly: v.supportedOnly,
        vsShotSupportedAreaBrightnessOnly: v.supportedOnlyBrightness,
        fonts: scene.meta.fonts,
      },
    };
  },
};
