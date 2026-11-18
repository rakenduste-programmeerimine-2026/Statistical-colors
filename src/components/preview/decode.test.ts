import { afterEach, describe, expect, it, vi } from "vitest";
import { decodeImage, MAX_PREVIEW_PIXELS, PreviewTooLargeError } from "./decode";

function stubBitmap(width: number, height: number) {
  const bitmap = { width, height, close: vi.fn() };
  const createImageBitmap = vi.fn().mockResolvedValue(bitmap);
  vi.stubGlobal("createImageBitmap", createImageBitmap);
  return { bitmap, createImageBitmap };
}

describe("decodeImage", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("asks the browser for stored values, with no colour conversion", async () => {
    const { createImageBitmap } = stubBitmap(2, 2);
    const blob = new Blob(["x"]);
    // jsdom has no canvas 2D (vitest.setup.ts), so decoding stops after the size check.
    await expect(decodeImage(blob)).rejects.toThrow("Canvas 2D is not available.");
    expect(createImageBitmap).toHaveBeenCalledWith(blob, { colorSpaceConversion: "none", premultiplyAlpha: "none" });
  });

  it("accepts an image of exactly the limit", async () => {
    const { bitmap } = stubBitmap(4096, 4096);
    expect(4096 * 4096).toBe(MAX_PREVIEW_PIXELS);
    await expect(decodeImage(new Blob())).rejects.not.toBeInstanceOf(PreviewTooLargeError);
    expect(bitmap.close).toHaveBeenCalled();
  });

  it("refuses one pixel row more, before making any copies, and frees the bitmap", async () => {
    const { bitmap } = stubBitmap(4096, 4097);
    const createElement = vi.spyOn(document, "createElement");
    const error = await decodeImage(new Blob()).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(PreviewTooLargeError);
    expect(error).toMatchObject({ width: 4096, height: 4097 });
    expect(createElement).not.toHaveBeenCalledWith("canvas");
    expect(bitmap.close).toHaveBeenCalled();
    createElement.mockRestore();
  });
});
