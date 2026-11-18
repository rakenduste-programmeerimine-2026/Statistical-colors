// Draws lattice points into a pixel buffer with a depth buffer, so 15–30k
// points stay a few milliseconds per frame without WebGL (P-036,
// performance-analyst). Pure: works on typed arrays, testable without a canvas.
import { basis, project, type Camera } from "./camera";

/** One 32-bit pixel as ImageData stores it on little-endian machines: A B G R. */
export const pack = (r: number, g: number, b: number, a = 255) => ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;

export interface Frame {
  width: number;
  height: number;
  pixels: Uint32Array;
  depth: Float32Array;
}

export function makeFrame(width: number, height: number): Frame {
  return { width, height, pixels: new Uint32Array(width * height), depth: new Float32Array(width * height) };
}

export function clearFrame(frame: Frame, background: number) {
  frame.pixels.fill(background);
  frame.depth.fill(Infinity);
}

export interface PointSet {
  x: Float32Array;
  y: Float32Array;
  z: Float32Array;
}

/** Square points of `size` device pixels, each pixel kept only if it is the nearest so far. */
export function splatSquares(frame: Frame, cam: Camera, pts: PointSet, indices: Int32Array, color: (i: number) => number, size: number) {
  const b = basis(cam);
  const { width, height, pixels, depth } = frame;
  const half = Math.floor(size / 2);
  for (let n = 0; n < indices.length; n++) {
    const i = indices[n];
    const p = project(cam, b, width, height, pts.x[i], pts.y[i], pts.z[i]);
    if (!p) continue;
    const x0 = Math.round(p.sx) - half;
    const y0 = Math.round(p.sy) - half;
    const c = color(i);
    for (let yy = y0; yy < y0 + size; yy++) {
      if (yy < 0 || yy >= height) continue;
      for (let xx = x0; xx < x0 + size; xx++) {
        if (xx < 0 || xx >= width) continue;
        const k = yy * width + xx;
        if (p.depth < depth[k]) {
          depth[k] = p.depth;
          pixels[k] = c;
        }
      }
    }
  }
}

/**
 * Filled discs drawn over everything, far to near, so the image's colours are
 * never hidden by the faint lattice points in front of them (P-035 step 2).
 * `ring` draws a 1-pixel outline in a contrasting colour so a disc stays
 * visible on a background of its own colour.
 */
export function splatDiscs(frame: Frame, cam: Camera, pts: PointSet, indices: Int32Array, color: (i: number) => number, radius: (i: number) => number, ring: number) {
  const b = basis(cam);
  const { width, height, pixels } = frame;
  const drawn: { i: number; sx: number; sy: number; depth: number }[] = [];
  for (let n = 0; n < indices.length; n++) {
    const i = indices[n];
    const p = project(cam, b, width, height, pts.x[i], pts.y[i], pts.z[i]);
    if (p) drawn.push({ i, ...p });
  }
  drawn.sort((p, q) => q.depth - p.depth);
  for (const d of drawn) {
    // Nearer discs are larger, as in a real 3D scene, from 0.6× to 1.6×.
    const r = radius(d.i) * Math.min(1.6, Math.max(0.6, 1.9 / d.depth));
    const c = color(d.i);
    const r2 = r * r;
    const ri2 = Math.max(0, r - 1) ** 2;
    for (let yy = Math.floor(d.sy - r); yy <= Math.ceil(d.sy + r); yy++) {
      if (yy < 0 || yy >= height) continue;
      for (let xx = Math.floor(d.sx - r); xx <= Math.ceil(d.sx + r); xx++) {
        if (xx < 0 || xx >= width) continue;
        const q = (xx - d.sx) ** 2 + (yy - d.sy) ** 2;
        if (q > r2) continue;
        pixels[yy * width + xx] = q > ri2 ? ring : c;
      }
    }
  }
  return drawn;
}

/** The index of the drawn point nearest the pointer, within `radius` pixels, or -1. */
export function pickNearest(cam: Camera, width: number, height: number, pts: PointSet, indices: Int32Array, mx: number, my: number, radius: number): number {
  const b = basis(cam);
  let best = -1;
  let bestD = radius * radius;
  let bestDepth = Infinity;
  for (let n = 0; n < indices.length; n++) {
    const i = indices[n];
    const p = project(cam, b, width, height, pts.x[i], pts.y[i], pts.z[i]);
    if (!p) continue;
    const d = (p.sx - mx) ** 2 + (p.sy - my) ** 2;
    // The nearest on screen; among equally near, the one closest to the camera.
    if (d < bestD || (d === bestD && p.depth < bestDepth)) {
      bestD = d;
      bestDepth = p.depth;
      best = i;
    }
  }
  return best;
}
