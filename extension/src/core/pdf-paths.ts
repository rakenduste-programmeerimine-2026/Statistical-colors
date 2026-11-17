// A small reader for the PDFs Chrome prints (Skia PDF backend). It extracts
// what the browser drew as vectors: every filled or stroked path with its
// colour, and the origin of every text run, in CSS px of the printed page with
// the origin top-left.
//
// Not a general PDF parser: no object streams, no encryption, no shading
// patterns (a path filled with one is reported with fill "pattern"). Kept
// hand-written after the library audit (P-023 item 8). Runs in a page, a
// worker or the extension service worker.

type Matrix = [number, number, number, number, number, number];
type Bbox = [number, number, number, number];

export interface PdfPath {
  d: string;
  fill: string | null;
  evenodd: boolean;
  stroke: string | null;
  strokeWidth: number;
  opacity: number;
  bbox: Bbox;
  order: number;
  /** Clip paths that cut into this path. */
  clips: string[];
}

export interface PdfText {
  x: number;
  y: number;
  size: number;
  glyphs: number | null;
  fill: string;
}

export interface PdfPage {
  width: number;
  height: number;
  paths: PdfPath[];
  texts: PdfText[];
}

const latin1 = (bytes: Uint8Array) => {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return s;
};
const mul = (a: number[], b: number[]): Matrix => [
  a[0] * b[0] + a[1] * b[2],
  a[0] * b[1] + a[1] * b[3],
  a[2] * b[0] + a[3] * b[2],
  a[2] * b[1] + a[3] * b[3],
  a[4] * b[0] + a[5] * b[2] + b[4],
  a[4] * b[1] + a[5] * b[3] + b[5],
];
const apply = (m: Matrix, x: number, y: number): [number, number] => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
const r3 = (v: number) => +v.toFixed(3);

/** Bounding box of points, with a loop rather than Math.min(...xs), which fails on very long paths. */
function bboxOf(pts: [number, number][]): Bbox {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [x, y] of pts) {
    if (x < x0) x0 = x;
    if (y < y0) y0 = y;
    if (x > x1) x1 = x;
    if (y > y1) y1 = y;
  }
  return [r3(x0), r3(y0), r3(x1), r3(y1)];
}

async function inflate(bytes: Uint8Array): Promise<Uint8Array> {
  const body = new Response(bytes.slice()).body as ReadableStream<BufferSource>;
  const out = new Response(body.pipeThrough(new DecompressionStream("deflate")));
  return new Uint8Array(await out.arrayBuffer());
}

export async function parsePdfPage(bytes: Uint8Array): Promise<PdfPage> {
  const src = latin1(bytes);
  const objs = new Map<number, number>();
  for (const m of src.matchAll(/(?:^|[\r\n])(\d+) 0 obj\b/g)) objs.set(+m[1], (m.index ?? 0) + m[0].length);
  const body = (id: number) => {
    const s = objs.get(id);
    if (s === undefined) return "";
    const e = src.indexOf("endobj", s);
    return src.slice(s, e < 0 ? undefined : e);
  };
  const num = (dict: string, key: string) => {
    const m = dict.match(new RegExp(`/${key}\\s+(-?[\\d.]+)(\\s+0\\s+R)?`));
    if (!m) return null;
    return m[2] ? parseFloat(body(+m[1])) : parseFloat(m[1]);
  };
  // Inflated once per object, even when a form is drawn many times (P-025 item 4).
  const streams = new Map<number, Promise<string>>();
  const stream = (id: number) => {
    let s = streams.get(id);
    if (!s) {
      s = (async () => {
        const start0 = objs.get(id) ?? 0;
        const b = body(id);
        const head = b.match(/stream\r?\n/);
        if (!head || head.index === undefined) return "";
        const dict = b.slice(0, head.index);
        const start = start0 + head.index + head[0].length;
        const raw = bytes.subarray(start, start + (num(dict, "Length") ?? 0));
        return latin1(/FlateDecode/.test(dict) ? await inflate(raw) : raw);
      })();
      streams.set(id, s);
    }
    return s;
  };
  // The balanced << … >> after a key, or the object a reference points to.
  const dictAfter = (text: string, key: string) => {
    const k = text.indexOf(`/${key}`);
    if (k < 0) return "";
    const ref = text.slice(k + key.length + 1).match(/^\s*(\d+)\s+0\s+R/);
    if (ref) return body(+ref[1]);
    const s = text.indexOf("<<", k);
    if (s < 0) return "";
    let depth = 0;
    for (let i = s; i < text.length - 1; i++) {
      if (text[i] === "<" && text[i + 1] === "<") {
        depth++;
        i++;
      } else if (text[i] === ">" && text[i + 1] === ">") {
        depth--;
        i++;
        if (!depth) return text.slice(s, i + 1);
      }
    }
    return "";
  };

  let pageId: number | null = null;
  for (const id of objs.keys()) {
    if (/\/Type\s*\/Page\b(?!s)/.test(body(id))) {
      pageId = id;
      break;
    }
  }
  if (pageId === null) throw new Error("No page object found in PDF");
  const page = body(pageId);
  const box = (page.match(/\/MediaBox\s*\[([^\]]+)\]/)?.[1] ?? "0 0 612 792").trim().split(/\s+/).map(Number);
  const pageH = box[3] - box[1];
  const PT = 96 / 72; // points → CSS px
  const toPx = (p: [number, number]): [number, number] => [(p[0] - box[0]) * PT, (pageH - (p[1] - box[1])) * PT];

  const paths: PdfPath[] = [];
  const texts: PdfText[] = [];

  type Colour = number[] | "pattern";
  type Clip = { d: string; bbox: Bbox };
  type GState = { ctm: Matrix; fill: Colour; stroke: Colour; lw: number; ca: number; CA: number; clips: Clip[] };

  async function run(content: string, resources: string, base: Matrix, depth: number): Promise<void> {
    const gsDict = dictAfter(resources, "ExtGState");
    const xoDict = dictAfter(resources, "XObject");
    const gsCache: Record<string, { lw: number | null; ca: number | null; CA: number | null }> = {};
    const gstate = (name: string) => {
      if (!gsCache[name]) {
        const m = gsDict.match(new RegExp(`/${name}\\s+(\\d+)\\s+0\\s+R`));
        const d = m ? body(+m[1]) : "";
        gsCache[name] = { lw: num(d, "LW"), ca: num(d, "ca"), CA: num(d, "CA") };
      }
      return gsCache[name];
    };
    let g: GState = { ctm: base, fill: [0, 0, 0], stroke: [0, 0, 0], lw: 1, ca: 1, CA: 1, clips: [] };
    let pendingClip = false;
    const stack: GState[] = [];
    const st: (number | string)[] = [];
    let d = "";
    let pts: [number, number][] = [];
    let cur: [number, number] = [0, 0];
    let tm: Matrix = [1, 0, 0, 1, 0, 0];
    let tlm: Matrix = tm;
    let fontSize = 0;
    const nums = (n: number) => st.splice(-n).map(Number);
    const P = (x: number, y: number) => {
      const p = toPx(apply(g.ctm, x, y));
      pts.push(p);
      return `${r3(p[0])} ${r3(p[1])}`;
    };
    const rgb = (c: Colour) => (c === "pattern" ? "pattern" : `rgb(${c.map((v) => Math.round(v * 255)).join(", ")})`);
    const colour = (n: 1 | 3 | 4): number[] => {
      const a = nums(n);
      if (n === 1) return [a[0], a[0], a[0]];
      if (n === 3) return a;
      return [(1 - a[0]) * (1 - a[3]), (1 - a[1]) * (1 - a[3]), (1 - a[2]) * (1 - a[3])];
    };
    const scn = (): Colour => {
      const last = st[st.length - 1];
      if (typeof last === "string" && last[0] === "/") {
        st.length = 0;
        return "pattern";
      }
      return colour(st.length >= 4 ? 4 : st.length >= 3 ? 3 : 1);
    };
    // "W n" makes the current path a clip for everything until the matching Q.
    const takeClip = () => {
      if (pendingClip && d && pts.length) g.clips = g.clips.concat([{ d: d.trim(), bbox: bboxOf(pts) }]);
      pendingClip = false;
    };
    const paint = (fill: boolean, stroke: boolean, evenodd = false) => {
      takeClip();
      if (d && pts.length) {
        const scale = Math.sqrt(Math.abs(g.ctm[0] * g.ctm[3] - g.ctm[1] * g.ctm[2])) * PT;
        const b = bboxOf(pts);
        paths.push({
          d: d.trim(),
          fill: fill ? rgb(g.fill) : null,
          evenodd,
          stroke: stroke ? rgb(g.stroke) : null,
          strokeWidth: stroke ? r3(Math.max(g.lw, 0) * scale || 1) : 0,
          opacity: fill ? g.ca : g.CA,
          bbox: b,
          order: paths.length,
          // Only clips that really cut this path.
          clips: g.clips
            .filter((c) => !(c.bbox[0] <= b[0] + 0.01 && c.bbox[1] <= b[1] + 0.01 && c.bbox[2] >= b[2] - 0.01 && c.bbox[3] >= b[3] - 0.01))
            .map((c) => c.d),
        });
      }
      d = "";
      pts = [];
    };
    // Tokens: numbers, /names, operators; strings, arrays and dictionaries are skipped.
    const re = /\s+|%[^\r\n]*|<<|>>|\[|\]|<[0-9A-Fa-f\s]*>|\((?:\\.|[^\\()])*\)|\/[^\s<>[\]()/%]*|[-+]?(?:\d+\.?\d*|\.\d+)|[A-Za-z'"*]+/g;
    let m: RegExpExecArray | null;
    let skip = 0;
    while ((m = re.exec(content))) {
      const t = m[0];
      if (/^\s|^%/.test(t)) continue;
      if (t === "<<" || t === "[") {
        skip++;
        continue;
      }
      if (t === ">>" || t === "]") {
        skip--;
        if (!skip) st.push("obj");
        continue;
      }
      if (skip) continue;
      if (/^[-+.\d]/.test(t)) {
        st.push(parseFloat(t));
        continue;
      }
      if (t[0] === "/" || t[0] === "<" || t[0] === "(") {
        st.push(t);
        continue;
      }
      switch (t) {
        case "q":
          stack.push({ ...g });
          break;
        case "Q":
          g = stack.pop() ?? g;
          break;
        case "cm":
          g.ctm = mul(nums(6), g.ctm);
          break;
        case "gs": {
          const s = gstate(String(st.pop()).slice(1));
          if (s.lw !== null) g.lw = s.lw;
          if (s.ca !== null) g.ca = s.ca;
          if (s.CA !== null) g.CA = s.CA;
          break;
        }
        case "w":
          g.lw = Number(st.pop());
          break;
        case "rg":
          g.fill = colour(3);
          break;
        case "RG":
          g.stroke = colour(3);
          break;
        case "g":
          g.fill = colour(1);
          break;
        case "G":
          g.stroke = colour(1);
          break;
        case "k":
          g.fill = colour(4);
          break;
        case "K":
          g.stroke = colour(4);
          break;
        case "sc":
        case "scn":
          g.fill = scn();
          break;
        case "SC":
        case "SCN":
          g.stroke = scn();
          break;
        case "m": {
          const [x, y] = nums(2);
          d += `M${P(x, y)}`;
          cur = [x, y];
          break;
        }
        case "l": {
          const [x, y] = nums(2);
          d += `L${P(x, y)}`;
          cur = [x, y];
          break;
        }
        case "c": {
          const a = nums(6);
          d += `C${P(a[0], a[1])} ${P(a[2], a[3])} ${P(a[4], a[5])}`;
          cur = [a[4], a[5]];
          break;
        }
        case "v": {
          const a = nums(4);
          d += `C${P(cur[0], cur[1])} ${P(a[0], a[1])} ${P(a[2], a[3])}`;
          cur = [a[2], a[3]];
          break;
        }
        case "y": {
          const a = nums(4);
          d += `C${P(a[0], a[1])} ${P(a[2], a[3])} ${P(a[2], a[3])}`;
          cur = [a[2], a[3]];
          break;
        }
        case "h":
          d += "Z";
          break;
        case "re": {
          const [x, y, w, h] = nums(4);
          d += `M${P(x, y)}L${P(x + w, y)}L${P(x + w, y + h)}L${P(x, y + h)}Z`;
          cur = [x, y];
          break;
        }
        case "f":
        case "F":
          paint(true, false);
          break;
        case "f*":
          paint(true, false, true);
          break;
        case "S":
          paint(false, true);
          break;
        case "s":
          d += "Z";
          paint(false, true);
          break;
        case "B":
          paint(true, true);
          break;
        case "B*":
          paint(true, true, true);
          break;
        case "b":
          d += "Z";
          paint(true, true);
          break;
        case "b*":
          d += "Z";
          paint(true, true, true);
          break;
        case "n":
          takeClip();
          d = "";
          pts = [];
          break;
        case "W":
        case "W*":
          pendingClip = true;
          break;
        case "BT":
          tm = [1, 0, 0, 1, 0, 0];
          tlm = tm;
          break;
        case "Tf":
          fontSize = Number(st.pop());
          st.pop();
          break;
        case "Tm":
          tm = tlm = nums(6) as Matrix;
          break;
        case "Td":
        case "TD": {
          const [x, y] = nums(2);
          tm = tlm = mul([1, 0, 0, 1, x, y], tlm);
          break;
        }
        case "Tj":
        case "TJ":
        case "'":
        case '"': {
          const s = st.pop();
          const full = mul(tm, g.ctm);
          const o = toPx(apply(full, 0, 0));
          const scale = Math.sqrt(Math.abs(full[0] * full[3] - full[1] * full[2])) * PT;
          const glyphs = typeof s === "string" && s[0] === "<" ? (s.length - 2) / 4 : null;
          texts.push({ x: r3(o[0]), y: r3(o[1]), size: r3(fontSize * scale), glyphs, fill: rgb(g.fill) });
          break;
        }
        case "Do": {
          const name = String(st.pop()).slice(1);
          const ref = xoDict.match(new RegExp(`/${name}\\s+(\\d+)\\s+0\\s+R`));
          if (ref && depth < 6) {
            const b = body(+ref[1]);
            if (/\/Subtype\s*\/Form/.test(b)) {
              const mm = b.match(/\/Matrix\s*\[([^\]]+)\]/);
              const mat = mm ? (mm[1].trim().split(/\s+/).map(Number) as Matrix) : ([1, 0, 0, 1, 0, 0] as Matrix);
              await run(await stream(+ref[1]), dictAfter(b, "Resources") || resources, mul(mat, g.ctm), depth + 1);
            }
          }
          break;
        }
        default:
          break; // BDC, EMC, ET and the rest: their operands are dropped below
      }
      st.length = 0;
    }
  }

  const refs = (page.match(/\/Contents\s*(\[[^\]]*\]|\d+\s+0\s+R)/)?.[1] ?? "").match(/\d+(?=\s+0\s+R)/g) ?? [];
  let content = "";
  for (const r of refs) content += `${await stream(+r)}\n`;
  await run(content, dictAfter(page, "Resources"), [1, 0, 0, 1, 0, 0], 0);
  return { width: (box[2] - box[0]) * PT, height: pageH * PT, paths, texts };
}

/** The paths and text origins inside one rectangle (page CSS px). */
export function pdfInBox(pdf: PdfPage, x: number, y: number, w: number, h: number, pad = 1.5) {
  const inside = (b: Bbox) => b[0] >= x - pad && b[1] >= y - pad && b[2] <= x + w + pad && b[3] <= y + h + pad;
  return {
    paths: pdf.paths.filter((p) => inside(p.bbox) && (p.fill !== null || p.stroke !== null)),
    texts: pdf.texts.filter((t) => t.x >= x - pad && t.x <= x + w + pad && t.y >= y - pad && t.y <= y + h + pad),
  };
}

let clipSeq = 0;

/** SVG for PDF paths, shifted by (−dx, −dy). Pattern-filled paths are left out. */
export function pathsToSvg(paths: PdfPath[], dx = 0, dy = 0): string {
  const body = paths
    .map((p) => {
      if (p.fill === "pattern" || p.stroke === "pattern") return "";
      const fill = p.fill ? ` fill="${p.fill}"${p.evenodd ? ' fill-rule="evenodd"' : ""}` : ' fill="none"';
      const stroke = p.stroke ? ` stroke="${p.stroke}" stroke-width="${p.strokeWidth}"` : "";
      let el = `<path d="${p.d}"${fill}${stroke}${p.opacity < 1 ? ` opacity="${p.opacity}"` : ""}/>`;
      for (const c of p.clips ?? []) {
        const id = `fs-pc-${clipSeq++}`;
        el = `<clipPath id="${id}"><path d="${c}"/></clipPath><g clip-path="url(#${id})">${el}</g>`;
      }
      return el;
    })
    .join("");
  return dx || dy ? `<g transform="translate(${r3(-dx)} ${r3(-dy)})">${body}</g>` : body;
}

/** Shifts an absolute M/L/C/Z path as produced above. */
export const translatePath = (d: string, dx: number, dy: number) => d.replace(/(-?[\d.]+) (-?[\d.]+)/g, (_, x, y) => `${r3(+x + dx)} ${r3(+y + dy)}`);
