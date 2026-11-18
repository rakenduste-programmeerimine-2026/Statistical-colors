// K1 · The page drawn again at k times its device scale, then screenshotted.
// Needs the debugger. Saves shot@<k>x.png.
import { dataUrlToBlob } from "../core/img.ts";
import { boxes, settle } from "../core/page-fns.ts";
import type { ApproachResult, Context } from "../core/pipeline.ts";

export type K1Result = ApproachResult & { image: ImageData; scale: number };

/** Chrome's largest canvas side, and the most pixels a k× image may have (64 MP, 256 MB as RGBA). */
export const MAX_SIDE = 16384;
export const MAX_PIXELS = 64_000_000;

/**
 * The largest scale up to `k`, halving from it, that keeps the k× image inside
 * Chrome's limits (performance-analyst, P-025 item 1). Never below 1.
 */
export function effectiveScale(vw: number, vh: number, dpr: number, k: number): number {
  let s = k;
  while (s > 1 && (Math.max(vw, vh) * dpr * s > MAX_SIDE || vw * vh * (dpr * s) ** 2 > MAX_PIXELS)) s /= 2;
  return Math.max(1, s);
}

/** How many box values moved by more than half a CSS px; -1 when the element count changed. */
export function boxesMoved(before: number[], after: number[]): number {
  if (before.length !== after.length) return -1;
  let moved = 0;
  for (let i = 0; i < before.length; i++) if (Math.abs(before[i] - after[i]) > 0.5) moved++;
  return moved;
}

export const K1 = {
  id: "K1",
  title: "Re-render at k×",
  needsDebugger: true,
  async run(ctx: Context): Promise<K1Result> {
    const { host } = ctx;
    const info = await ctx.info();
    const k = effectiveScale(info.vw, info.vh, info.dpr, ctx.opts.scale);
    const before = await host.page(boxes);
    let data: string;
    let after: number[];
    await host.cdp("Emulation.setDeviceMetricsOverride", { width: info.vw, height: info.vh, deviceScaleFactor: info.dpr * k, mobile: false });
    try {
      await host.page(settle);
      ({ data } = await host.cdp<{ data: string }>("Page.captureScreenshot", { format: "png" }));
      after = await host.page(boxes);
    } finally {
      // Back to the viewport the run pinned, or to no override at all.
      if (ctx.baseMetrics) await host.cdp("Emulation.setDeviceMetricsOverride", ctx.baseMetrics);
      else await host.cdp("Emulation.clearDeviceMetricsOverride");
      await host.page(settle);
    }
    // Saved as Chrome encoded it; decoding and encoding again would cost time and memory.
    const png = dataUrlToBlob(`data:image/png;base64,${data}`);
    await ctx.save(`shot@${k}x.png`, png);
    const image = await ctx.decode(png);
    const moved = boxesMoved(before, after);
    const expected = [Math.round(info.vw * info.dpr * k), Math.round(info.vh * info.dpr * k)];
    return {
      image,
      scale: k,
      report: {
        requestedScale: ctx.opts.scale,
        effectiveScale: k,
        pixelSize: [image.width, image.height],
        expected,
        sizeOk: image.width === expected[0] && image.height === expected[1],
        layoutUnchanged: moved === 0,
        boxValuesMoved: moved,
      },
    };
  },
};
