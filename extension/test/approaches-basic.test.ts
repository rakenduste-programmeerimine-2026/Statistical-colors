import { describe, expect, it } from "vitest";
import { D1, forceTextColour, matte } from "../src/approaches/d1-matte.ts";
import { boxesMoved, effectiveScale, K1 } from "../src/approaches/k1-hires.ts";
import { pdfPaper, S3 } from "../src/approaches/s3-pdf.ts";
import type { Pixels } from "../src/core/img.ts";
import { makeContext } from "../src/core/pipeline.ts";
import { fakeCodec, fakeHost, queuedCodec } from "./fake-host.ts";

/** A w × h image; pixel i takes colours[i], or colours[0] when there are fewer. */
const img = (w: number, h: number, ...colours: number[][]): Pixels => {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) data.set([...(colours[i] ?? colours[0]), 255], i * 4);
  return { width: w, height: h, data };
};

describe("K1", () => {
  it.each([
    [[0, 0, 10, 10], [0.5, 0, 10, 10], 0],
    [[0, 0, 10, 10], [0.6, 0, 10, 10.6], 2],
    [[0, 0, 10, 10], [0, 0, 10, 10, 1, 1, 1, 1], -1],
  ])("counts moved box values: %j → %j is %i", (before, after, moved) => {
    expect(boxesMoved(before, after)).toBe(moved);
  });

  it.each([
    ["fits", 800, 600, 1, 4, 4],
    ["side exactly 16384", 4096, 1, 1, 4, 4],
    ["side one over 16384", 4097, 1, 1, 4, 2],
    ["8× at DPR 2 on 1920 × 1080", 1920, 1080, 2, 8, 2],
    ["nothing fits, stays at 1", 20000, 20000, 1, 2, 1],
  ])("limits the k× scale: %s", (_, vw, vh, dpr, k, expected) => {
    expect(effectiveScale(vw, vh, dpr, k)).toBe(expected);
  });

  it("re-renders at k× and goes back to the pinned viewport", async () => {
    const { host } = fakeHost({ boxes: [0, 0, 10, 10] });
    host.cdp.mockImplementation(async (method: string) => (method === "Page.captureScreenshot" ? { data: "AAAA" } : {}));
    const ctx = makeContext(host, { scale: 4 }, queuedCodec([img(3200, 2400, [0, 0, 0])]));
    ctx.baseMetrics = { width: 800, height: 600, deviceScaleFactor: 0, mobile: false };
    const res = await K1.run(ctx);

    expect(host.cdp).toHaveBeenCalledWith("Emulation.setDeviceMetricsOverride", { width: 800, height: 600, deviceScaleFactor: 4, mobile: false });
    expect(host.cdp).toHaveBeenLastCalledWith("Emulation.setDeviceMetricsOverride", ctx.baseMetrics);
    expect(res.report).toEqual({
      requestedScale: 4,
      effectiveScale: 4,
      pixelSize: [3200, 2400],
      expected: [3200, 2400],
      sizeOk: true,
      layoutUnchanged: true,
      boxValuesMoved: 0,
    });
    expect(ctx.files).toEqual(["shot@4x.png"]);
  });

  it("clears the override when none was pinned, even after a failed screenshot", async () => {
    const { host } = fakeHost({ boxes: [] });
    host.cdp.mockImplementation(async (method: string) => {
      if (method === "Page.captureScreenshot") throw new Error("gone");
      return {};
    });
    await expect(K1.run(makeContext(host, {}, fakeCodec))).rejects.toThrow("gone");
    expect(host.cdp).toHaveBeenLastCalledWith("Emulation.clearDeviceMetricsOverride");
  });
});

describe("S3", () => {
  it.each([
    [960, 1920, { paperWidth: 10, paperHeight: 20 }],
    [960, 19200, { paperWidth: 10, paperHeight: 200 }],
    [960, 19296, { paperWidth: 10, paperHeight: 200 }],
  ])("sizes the page for a %i × %i document, at most 200 inches tall", (w, h, paper) => {
    expect(pdfPaper(w, h)).toEqual(paper);
  });

  it("prints with screen styles, saves the PDF and resets the media", async () => {
    const { host } = fakeHost();
    host.cdp.mockImplementation(async (method: string) => (method === "Page.printToPDF" ? { data: "JVBERg==" } : {}));
    const res = await S3.run(makeContext(host, {}, fakeCodec));
    expect(host.cdp).toHaveBeenCalledWith("Emulation.setEmulatedMedia", { media: "screen" });
    expect(host.cdp).toHaveBeenLastCalledWith("Emulation.setEmulatedMedia", { media: "" });
    expect(new TextDecoder().decode(res.pdf)).toBe("%PDF");
    expect(res.report).toEqual({ bytes: 4, pageCssSize: [800, 1200], viewportOffset: [0, 0] });
  });

  it("resets the media when printing fails", async () => {
    const { host } = fakeHost();
    host.cdp.mockImplementation(async (method: string) => {
      if (method === "Page.printToPDF") throw new Error("no");
      return {};
    });
    await expect(S3.run(makeContext(host, {}, fakeCodec))).rejects.toThrow("no");
    expect(host.cdp).toHaveBeenLastCalledWith("Emulation.setEmulatedMedia", { media: "" });
  });
});

describe("D1", () => {
  it("recovers coverage and background from black and white text", () => {
    // Pixels: no text on grey 100; half-covered text; fully covered text; subpixel text.
    const black = img(4, 1, [100, 100, 100], [50, 50, 50], [0, 0, 0], [80, 50, 20]);
    const white = img(4, 1, [100, 100, 100], [178, 178, 178], [255, 255, 255], [131, 178, 224]);
    const m = matte(black, black, white);
    expect([...m.alpha.data]).toEqual([0, 0, 0, 255, 128, 128, 128, 255, 255, 255, 255, 255, 51, 128, 204, 255]);
    // The fully covered pixel borrows the background of its left neighbour.
    expect([...m.background.data]).toEqual([100, 100, 100, 255, 100, 100, 100, 255, 100, 100, 100, 255, 100, 100, 100, 255]);
    expect(m.cover[0]).toBe(0);
    expect(m.textPixelPct).toBe(75);
    expect(m.subpixelTextPct).toBe(33.33);
  });

  it("takes the original pixel for a fully covered pixel at the left edge", () => {
    const m = matte(img(1, 1, [9, 8, 7]), img(1, 1, [0, 0, 0]), img(1, 1, [255, 255, 255]));
    expect([...m.background.data]).toEqual([9, 8, 7, 255]);
  });

  it("forces one text colour and pauses animations", () => {
    expect(forceTextColour("#000")).toContain("color:#000!important;-webkit-text-fill-color:#000!important");
    expect(forceTextColour("#fff")).toContain("animation-play-state:paused!important");
  });

  it("takes the extra shots and always removes its style", async () => {
    const shot = img(2, 1, [100, 100, 100]);
    const { host, calls } = fakeHost();
    const ctx = makeContext(host, {}, queuedCodec([shot, img(2, 1, [0, 0, 0]), img(2, 1, [255, 255, 255]), shot]));
    const res = await D1.run(ctx);
    expect(calls.filter((c) => c === "page injectStyle")).toHaveLength(2);
    expect(calls).toContain("page removeStyle");
    expect(res.report).toMatchObject({ pageStatic: true, textPixelPct: 100 });
    expect(ctx.files).toEqual(["shot.png", "text-alpha.png", "background.png"]);
  });

  it("refuses shots of a different size", async () => {
    const { host } = fakeHost();
    const ctx = makeContext(host, {}, queuedCodec([img(2, 1, [0, 0, 0]), img(3, 1, [0, 0, 0])]));
    await expect(D1.run(ctx)).rejects.toThrow("Viewport changed during capture (2×1 → black 3×1)");
  });
});
