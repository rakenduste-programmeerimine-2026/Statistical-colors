// Pixel helpers. They work in a page, a worker or the extension service worker:
// OffscreenCanvas and createImageBitmap only, no DOM. Colours stay 8-bit sRGB (P-011).

/** The shape of ImageData, so pure helpers can be tested without a canvas. */
export interface Pixels {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export type Rgba = [r: number, g: number, b: number, a: number];

/** Decodes to the stored values: no colour-profile conversion, no premultiplied alpha. */
export async function decode(src: Blob | string | ImageData): Promise<ImageData> {
  if (src instanceof ImageData) return src;
  const blob = typeof src === "string" ? dataUrlToBlob(src) : src;
  const bmp = await createImageBitmap(blob, { premultiplyAlpha: "none", colorSpaceConversion: "none" });
  try {
    const c = new OffscreenCanvas(bmp.width, bmp.height);
    const ctx = c.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("OffscreenCanvas 2D is not available.");
    ctx.drawImage(bmp, 0, 0);
    return ctx.getImageData(0, 0, c.width, c.height);
  } finally {
    bmp.close();
  }
}

export async function encode(img: Pixels): Promise<Blob> {
  const c = new OffscreenCanvas(img.width, img.height);
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("OffscreenCanvas 2D is not available.");
  ctx.putImageData(img instanceof ImageData ? img : new ImageData(new Uint8ClampedArray(img.data), img.width, img.height), 0, 0);
  return c.convertToBlob({ type: "image/png" });
}

export function dataUrlToBlob(url: string): Blob {
  const comma = url.indexOf(",");
  const head = url.slice(0, comma);
  const mime = head.match(/data:([^;,]+)/)?.[1] ?? "application/octet-stream";
  const bin = atob(url.slice(comma + 1));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export async function blobToDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = "";
  // Chunked, because String.fromCharCode cannot take millions of arguments.
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:${blob.type || "application/octet-stream"};base64,${btoa(bin)}`;
}

/** A copy of the rectangle, rounded and clipped to the image. Nothing inside gives a transparent 1 × 1. */
export function crop(img: Pixels, x: number, y: number, w: number, h: number): Pixels {
  x = Math.max(0, Math.round(x));
  y = Math.max(0, Math.round(y));
  w = Math.min(img.width - x, Math.round(w));
  h = Math.min(img.height - y, Math.round(h));
  if (w < 1 || h < 1) return { width: 1, height: 1, data: new Uint8ClampedArray(4) };
  const data = new Uint8ClampedArray(w * h * 4);
  for (let r = 0; r < h; r++) {
    const from = ((y + r) * img.width + x) * 4;
    data.set(img.data.subarray(from, from + w * 4), r * w * 4);
  }
  return { width: w, height: h, data };
}

export interface DiffOptions {
  /** Largest per-channel difference still counted as "within tolerance". */
  tol?: number;
  /** 1 = ignore this pixel. */
  mask?: Uint8Array | null;
  /** Also return a red-on-grey heat image of the differences. */
  heat?: boolean;
  /** Compare brightness only, which ignores the colour fringes of subpixel (LCD) text. */
  luma?: boolean;
}

export interface DiffResult {
  exactPct: number;
  tolPct: number;
  maxDiff: number;
  compared: number;
  tol?: number;
  sizeMismatch?: [number, number, number, number];
  heat?: Pixels | null;
}

/** Compares two frames; percentages are over the compared (unmasked) pixels, to 3 decimals. */
export function diff(a: Pixels, b: Pixels, { tol = 8, mask = null, heat = false, luma = false }: DiffOptions = {}): DiffResult {
  if (a.width !== b.width || a.height !== b.height) {
    return { sizeMismatch: [a.width, a.height, b.width, b.height], exactPct: 0, tolPct: 0, maxDiff: 255, compared: 0 };
  }
  const n = a.width * a.height;
  const A = a.data;
  const B = b.data;
  let exact = 0;
  let within = 0;
  let max = 0;
  let compared = 0;
  const H = heat ? new Uint8ClampedArray(n * 4) : null;
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const d = luma
      ? Math.round(Math.abs(A[o] + A[o + 1] + A[o + 2] - B[o] - B[o + 1] - B[o + 2]) / 3)
      : Math.max(Math.abs(A[o] - B[o]), Math.abs(A[o + 1] - B[o + 1]), Math.abs(A[o + 2] - B[o + 2]));
    if (H) {
      const g = ((A[o] + A[o + 1] + A[o + 2]) / 3) * 0.25 + 190;
      H[o] = d ? 255 : g;
      H[o + 1] = d ? Math.max(0, 200 - d * 4) : g;
      H[o + 2] = d ? 0 : g;
      H[o + 3] = 255;
      if (mask?.[i]) H.set([120, 140, 255], o);
    }
    if (mask?.[i]) continue;
    compared++;
    if (d === 0) exact++;
    if (d <= tol) within++;
    if (d > max) max = d;
  }
  const pct = (v: number) => (compared ? Math.round((v / compared) * 1e5) / 1e3 : 0);
  return {
    exactPct: pct(exact),
    tolPct: pct(within),
    maxDiff: max,
    compared,
    tol,
    heat: H && { width: a.width, height: a.height, data: H },
  };
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Rectangles in CSS px → a pixel mask (1 = inside) at `scale`, grown by `pad` CSS px. */
export function rectMask(width: number, height: number, rects: Rect[], scale = 1, pad = 0): Uint8Array {
  const m = new Uint8Array(width * height);
  for (const r of rects) {
    const x0 = Math.max(0, Math.floor((r.x - pad) * scale));
    const y0 = Math.max(0, Math.floor((r.y - pad) * scale));
    const x1 = Math.min(width, Math.ceil((r.x + r.w + pad) * scale));
    const y1 = Math.min(height, Math.ceil((r.y + r.h + pad) * scale));
    for (let y = y0; y < y1; y++) m.fill(1, y * width + x0, y * width + x1);
  }
  return m;
}

export const rgbInt = (r: number, g: number, b: number) => (r << 16) | (g << 8) | b;

/** Reads any CSS colour by painting it, so the result is the 8-bit sRGB the screenshot holds. */
export type ColorFallback = (css: string) => Rgba | null;

export const canvasColor: ColorFallback = (css) => {
  const ctx = new OffscreenCanvas(1, 1).getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  // An invalid colour leaves fillStyle unchanged, so two different previous values give two results.
  ctx.fillStyle = "#010203";
  ctx.fillStyle = css;
  const first = ctx.fillStyle;
  ctx.fillStyle = "#040506";
  ctx.fillStyle = css;
  if (ctx.fillStyle !== first) return null;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
  return [r, g, b, a / 255];
};

/**
 * `rgb()`/`rgba()` and Skia's `#AARRGGBB` are read directly. Anything else, such
 * as `oklch()` from computed styles, goes to `fallback` (P-023 item 8).
 */
export function parseColor(s: string | null | undefined, fallback: ColorFallback | null = null): Rgba | null {
  if (!s) return null;
  let m = s.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?\s*\)$/);
  if (m) return [Math.round(+m[1]), Math.round(+m[2]), Math.round(+m[3]), m[4] === undefined ? 1 : +m[4]];
  m = s.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (m) return [parseInt(m[2], 16), parseInt(m[3], 16), parseInt(m[4], 16), parseInt(m[1], 16) / 255];
  return fallback ? fallback(s) : null;
}
