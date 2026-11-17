// D1 · Differential matting: two extra lossless shots with all text forced to
// black, then to white. Per pixel and channel,
//     alpha = (white − black) / 255,   background = black / (1 − alpha).
// Text colour never changes layout, so the geometry is the same in every shot.
// Saves text-alpha.png (text coverage) and background.png (the page without text).
import { diff, type Pixels } from "../core/img.ts";
import { injectStyle, removeStyle, settle } from "../core/page-fns.ts";
import type { ApproachResult, Context } from "../core/pipeline.ts";

const STYLE_ID = "__fs_matte";

/** CSS that paints all text in one colour and stops anything that would move between shots. */
export const forceTextColour = (c: string) =>
  `*,*::before,*::after{color:${c}!important;-webkit-text-fill-color:${c}!important;` +
  "text-shadow:none!important;caret-color:transparent!important;transition:none!important;animation-play-state:paused!important}";

const blank = (w: number, h: number): Pixels => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) });

/**
 * The matte maths. `cover` is the mean coverage per pixel (0..1). A pixel
 * counts as text above 2 % coverage, and as subpixel (LCD) text when its
 * channels differ by more than 6 %.
 */
export function matte(original: Pixels, black: Pixels, white: Pixels) {
  const W = original.width;
  const n = W * original.height;
  const alpha = blank(W, original.height);
  const background = blank(W, original.height);
  const cover = new Float32Array(n);
  let textPx = 0;
  let lcdPx = 0;
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    let amin = 1;
    let amax = 0;
    let asum = 0;
    for (let c = 0; c < 3; c++) {
      const a = Math.min(1, Math.max(0, (white.data[o + c] - black.data[o + c]) / 255));
      alpha.data[o + c] = Math.round(a * 255);
      asum += a;
      amin = Math.min(amin, a);
      amax = Math.max(amax, a);
      // A fully covered pixel says nothing about the background: take the pixel to its left.
      background.data[o + c] =
        a < 0.97 ? Math.min(255, Math.round(black.data[o + c] / (1 - a))) : i % W ? background.data[o - 4 + c] : original.data[o + c];
    }
    alpha.data[o + 3] = background.data[o + 3] = 255;
    cover[i] = asum / 3;
    if (amax > 0.02) {
      textPx++;
      if (amax - amin > 0.06) lcdPx++;
    }
  }
  return {
    alpha,
    background,
    cover,
    textPixelPct: Math.round((textPx / n) * 1e4) / 100,
    subpixelTextPct: textPx ? Math.round((lcdPx / textPx) * 1e4) / 100 : 0,
  };
}

export type D1Result = ApproachResult & {
  alpha: Pixels;
  background: Pixels;
  cover: Float32Array;
  report: { subpixelTextPct: number } & Record<string, unknown>;
};

export const D1 = {
  id: "D1",
  title: "Text/background matting",
  needsDebugger: false,
  async run(ctx: Context): Promise<D1Result> {
    const { host } = ctx;
    const original = await ctx.shot();
    let black: Pixels;
    let white: Pixels;
    try {
      await host.page(injectStyle, STYLE_ID, forceTextColour("#000"));
      await host.page(settle);
      black = await ctx.takeShot();
      await host.page(injectStyle, STYLE_ID, forceTextColour("#fff"));
      await host.page(settle);
      white = await ctx.takeShot();
    } finally {
      await host.page(removeStyle, STYLE_ID);
      await host.page(settle);
    }
    const again = await ctx.takeShot();
    for (const [name, img] of [["black", black], ["white", white], ["after", again]] as const) {
      if (img.width !== original.width || img.height !== original.height) {
        throw new Error(`Viewport changed during capture (${original.width}×${original.height} → ${name} ${img.width}×${img.height})`);
      }
    }
    // Did anything other than text change while the shots were taken?
    const stat = diff(original, again, { tol: 0, heat: true });
    if (stat.exactPct !== 100 && stat.heat) await ctx.save("matte-static-check.png", stat.heat);

    const m = matte(original, black, white);
    await ctx.save("text-alpha.png", m.alpha);
    await ctx.save("background.png", m.background);
    return {
      alpha: m.alpha,
      background: m.background,
      cover: m.cover,
      // The black and white shots are not kept: nothing reads them, and each is a full shot of memory.
      report: {
        // A repaint can shift a few antialiased corner pixels by a level or two
        // on a page that did not change, so a trace of difference is allowed.
        pageStatic: stat.exactPct >= 99.95,
        staticCheckExactPct: stat.exactPct,
        staticCheckMaxDiff: stat.maxDiff,
        textPixelPct: m.textPixelPct,
        subpixelTextPct: m.subpixelTextPct,
      },
    };
  },
};
