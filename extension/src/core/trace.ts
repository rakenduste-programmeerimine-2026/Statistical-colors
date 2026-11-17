// Traces flat-colour regions of an image into vector outlines. Deterministic:
// boundaries follow pixel edges and are then simplified. Meant for the k×
// image after palette snapping, where every pixel is a declared colour and
// edges are hard, so an outline is accurate to about 1/k of a CSS pixel.
import type { Pixels } from "./img.ts";

type Point = [number, number];

/** Regions larger than this are not traced or quantised (P-025 item 4). */
export const MAX_TRACE_PIXELS = 1.5e6;

/** Douglas–Peucker on an open polyline; the end points are always kept. */
export function simplify(pts: Point[], tol: number): Point[] {
  if (pts.length < 5) return pts;
  const keep = new Uint8Array(pts.length);
  const stack: [number, number][] = [[0, pts.length - 1]];
  keep[0] = keep[pts.length - 1] = 1;
  while (stack.length) {
    const [a, b] = stack.pop() as [number, number];
    const [ax, ay] = pts[a];
    const [bx, by] = pts[b];
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy) || 1;
    let worst = 0;
    let at = -1;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((pts[i][0] - ax) * dy - (pts[i][1] - ay) * dx) / len;
      if (d > worst) {
        worst = d;
        at = i;
      }
    }
    if (worst > tol) {
      keep[at] = 1;
      stack.push([a, at], [at, b]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

/** The region clipped to the image and rounded, or null when it is empty or too large. */
function region(img: Pixels, x0: number, y0: number, w: number, h: number) {
  x0 = Math.max(0, Math.round(x0));
  y0 = Math.max(0, Math.round(y0));
  w = Math.min(img.width - x0, Math.round(w));
  h = Math.min(img.height - y0, Math.round(h));
  return w < 1 || h < 1 || w * h > MAX_TRACE_PIXELS ? null : { x0, y0, w, h };
}

/**
 * Outlines of every colour in a region, as SVG in CSS px relative to the
 * region (k = image px per CSS px), or null when the region is too small, too
 * large or has more than `maxColours` colours. The most common colour becomes
 * a background rectangle; each other colour becomes one even-odd path.
 */
export function traceRegion(img: Pixels, x0: number, y0: number, w: number, h: number, k: number, { tol = 0.8, maxColours = 24 } = {}) {
  const r = region(img, x0, y0, w, h);
  if (!r || r.w < 2 || r.h < 2) return null;
  ({ x0, y0, w, h } = r);
  const px = new Int32Array(w * h);
  const count = new Map<number, number>();
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = ((y0 + y) * img.width + x0 + x) * 4;
      const c = (img.data[o] << 16) | (img.data[o + 1] << 8) | img.data[o + 2];
      px[y * w + x] = c;
      count.set(c, (count.get(c) ?? 0) + 1);
    }
  }
  if (count.size > maxColours) return null;
  const order = [...count].sort((a, b) => b[1] - a[1]);
  const bg = order[0][0];
  const hex = (c: number) => `rgb(${c >> 16}, ${(c >> 8) & 255}, ${c & 255})`;
  const f = (v: number) => +(v / k).toFixed(3);
  let svg = `<rect width="${f(w)}" height="${f(h)}" fill="${hex(bg)}"/>`;
  let loops = 0;
  const W1 = w + 1;
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? -1 : px[y * w + x]);
  for (const [c] of order.slice(1)) {
    // Directed boundary edges with the region on the right, keyed by start vertex.
    const out = new Map<number, Point[]>();
    const add = (ax: number, ay: number, bx: number, by: number) => {
      const key = ay * W1 + ax;
      let list = out.get(key);
      if (!list) out.set(key, (list = []));
      list.push([bx, by]);
    };
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (px[y * w + x] !== c) continue;
        if (at(x, y - 1) !== c) add(x, y, x + 1, y);
        if (at(x + 1, y) !== c) add(x + 1, y, x + 1, y + 1);
        if (at(x, y + 1) !== c) add(x + 1, y + 1, x, y + 1);
        if (at(x - 1, y) !== c) add(x, y + 1, x, y);
      }
    }
    let d = "";
    for (const [startKey, list] of out) {
      while (list.length) {
        const sx = startKey % W1;
        const sy = (startKey - sx) / W1;
        const pts: Point[] = [[sx, sy]];
        let [cx, cy] = list.pop() as Point;
        let px0 = sx;
        let py0 = sy;
        for (let guard = 0; guard < 4e6; guard++) {
          pts.push([cx, cy]);
          if (cx === sx && cy === sy) break;
          const next = out.get(cy * W1 + cx);
          if (!next?.length) break;
          // Where two pixels touch only at a corner, turn right so they stay separate shapes.
          const dx = cx - px0;
          const dy = cy - py0;
          let pick = 0;
          let best = -2;
          for (let i = 0; i < next.length; i++) {
            const cross = dx * (next[i][1] - cy) - dy * (next[i][0] - cx);
            if (cross > best) {
              best = cross;
              pick = i;
            }
          }
          px0 = cx;
          py0 = cy;
          [cx, cy] = next.splice(pick, 1)[0];
        }
        // A closed loop starts and ends at the same point, so it is split at the
        // point farthest from the start and the two halves are simplified.
        let far = 0;
        let fd = -1;
        for (let i = 1; i < pts.length - 1; i++) {
          const q = (pts[i][0] - sx) ** 2 + (pts[i][1] - sy) ** 2;
          if (q > fd) {
            fd = q;
            far = i;
          }
        }
        const s = far ? simplify(pts.slice(0, far + 1), tol).concat(simplify(pts.slice(far), tol).slice(1)) : pts;
        if (s.length >= 4) {
          d += `M${s
            .slice(0, -1)
            .map((p) => `${f(p[0])} ${f(p[1])}`)
            .join("L")}Z`;
          loops++;
        }
      }
    }
    if (d) svg += `<path fill-rule="evenodd" fill="${hex(c)}" d="${d}"/>`;
  }
  return { svg, colours: count.size, loops };
}

/**
 * Reduces a crop to its own flat colours: a colour covering at least `share`
 * of the crop is kept, and every other pixel takes the nearest kept colour.
 * Removes antialiasing without the page's declared palette. Null when the
 * region is empty or larger than MAX_TRACE_PIXELS, which the tracer would reject anyway.
 */
export function quantiseLocal(img: Pixels, x0: number, y0: number, w: number, h: number, share = 0.012): Pixels | null {
  const r = region(img, x0, y0, w, h);
  if (!r) return null;
  ({ x0, y0, w, h } = r);
  const out: Pixels = { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) };
  const hist = new Map<number, number>();
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = ((y0 + y) * img.width + x0 + x) * 4;
      const c = (img.data[o] << 16) | (img.data[o + 1] << 8) | img.data[o + 2];
      hist.set(c, (hist.get(c) ?? 0) + 1);
    }
  }
  const keep = [...hist].filter(([, n]) => n >= w * h * share).map(([c]) => [c >> 16, (c >> 8) & 255, c & 255]);
  if (!keep.length) return null;
  const cache = new Map<number, number[]>();
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = ((y0 + y) * img.width + x0 + x) * 4;
      const red = img.data[o];
      const g = img.data[o + 1];
      const b = img.data[o + 2];
      const key = (red << 16) | (g << 8) | b;
      let best = cache.get(key);
      if (!best) {
        let bd = Infinity;
        for (const c of keep) {
          const dd = (c[0] - red) ** 2 + (c[1] - g) ** 2 + (c[2] - b) ** 2;
          if (dd < bd) {
            bd = dd;
            best = c;
          }
        }
        cache.set(key, best as number[]);
      }
      const q = (y * w + x) * 4;
      out.data.set([...(best as number[]), 255], q);
    }
  }
  return out;
}
