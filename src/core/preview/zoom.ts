/**
 * Zoom and pan math for the exact pixel preview, ported from the reference
 * Exact Pixel Viewer. Positive level n draws each image pixel as an n × n block
 * of screen pixels. Negative n shows every n-th pixel, unblended, so zooming out
 * never invents colours either.
 */
export const ZOOM_LEVELS = [-8, -6, -4, -3, -2, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 24, 32, 48, 64] as const;
export const ONE_TO_ONE = ZOOM_LEVELS.indexOf(1);
/** The grid is drawn only when cells are at least this many screen pixels wide. */
export const GRID_MIN_FACTOR = 6;

export interface Size {
  width: number;
  height: number;
}

/** Index into `ZOOM_LEVELS` and the image offset in whole device pixels. */
export interface View {
  level: number;
  ox: number;
  oy: number;
}

export const clampLevel = (level: number) => Math.max(0, Math.min(ZOOM_LEVELS.length - 1, level));

export function zoomFactor(level: number): number {
  const n = ZOOM_LEVELS[clampLevel(level)];
  return n > 0 ? n : 1 / -n;
}

export function zoomLabel(level: number): string {
  const n = ZOOM_LEVELS[clampLevel(level)];
  return n > 0 ? `${n}×` : `1/${-n}`;
}

/** The image centred in the viewport at `level`. */
export function centered(level: number, image: Size, viewport: Size): View {
  const z = zoomFactor(level);
  return {
    level,
    ox: Math.round((viewport.width - image.width * z) / 2),
    oy: Math.round((viewport.height - image.height * z) / 2),
  };
}

/** The largest level at which the whole image fits, centred. Falls back to the smallest level. */
export function fit(image: Size, viewport: Size): View {
  let best = 0;
  ZOOM_LEVELS.forEach((_, i) => {
    const z = zoomFactor(i);
    if (image.width * z <= viewport.width && image.height * z <= viewport.height) best = i;
  });
  return centered(best, image, viewport);
}

/** Changes the level while the image point under (ax, ay) stays where it is. */
export function zoomAt(view: View, level: number, ax: number, ay: number): View {
  const next = clampLevel(level);
  const before = zoomFactor(view.level);
  const ix = (ax - view.ox) / before;
  const iy = (ay - view.oy) / before;
  const z = zoomFactor(next);
  return {
    level: next,
    ox: Math.round(ax - ix * z),
    oy: Math.round(ay - iy * z),
  };
}

/** The image pixel under device point (x, y), or null outside the image. */
export function pixelAt(view: View, x: number, y: number, image: Size): { x: number; y: number } | null {
  const z = zoomFactor(view.level);
  const ix = Math.floor((x - view.ox) / z);
  const iy = Math.floor((y - view.oy) / z);
  if (ix < 0 || iy < 0 || ix >= image.width || iy >= image.height) return null;
  return { x: ix, y: iy };
}
