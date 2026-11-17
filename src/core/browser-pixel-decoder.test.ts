import { describe, expect, it, vi } from "vitest";
import {
  createBrowserPixelDecoder,
  type BrowserPixelDecoderEnvironment,
} from "./browser-pixel-decoder";
import { ExactDecodingUnsupportedError } from "./pixel-decoder";

// jsdom has neither createImageBitmap nor a working 2D canvas, so the adapter
// is tested against stubs. Real-browser behaviour is checked manually.

function createFakeBitmap(width: number, height: number) {
  const close = vi.fn();
  return { bitmap: { width, height, close } as unknown as ImageBitmap, close };
}

function createFakeCanvas(pixels: Uint8ClampedArray | null) {
  const ctx = {
    drawImage: vi.fn(),
    getImageData: vi.fn<
      (x: number, y: number, w: number, h: number) => { data: unknown }
    >(() => ({ data: pixels })),
  };
  const canvas = {
    width: 0,
    height: 0,
    getContext: vi.fn(() => (pixels ? ctx : null)),
  };
  return { canvas, ctx, asCanvas: () => canvas as unknown as HTMLCanvasElement };
}

function environment(
  bitmap: ImageBitmap,
  canvas: HTMLCanvasElement,
): BrowserPixelDecoderEnvironment {
  return {
    createImageBitmap: vi.fn().mockResolvedValue(bitmap),
    createCanvas: () => canvas,
  };
}

const file = new Blob([new Uint8Array([1, 2, 3])]);

describe("createBrowserPixelDecoder", () => {
  it("decodes with colour conversion and premultiplied alpha turned off", async () => {
    const { bitmap } = createFakeBitmap(1, 1);
    const fake = createFakeCanvas(new Uint8ClampedArray(4));
    const env = environment(bitmap, fake.asCanvas());

    await createBrowserPixelDecoder(() => env).decode(file);

    expect(env.createImageBitmap).toHaveBeenCalledWith(file, {
      colorSpaceConversion: "none",
      premultiplyAlpha: "none",
    });
  });

  it("returns the getImageData pixels unchanged", async () => {
    const { bitmap } = createFakeBitmap(2, 1);
    const pixels = new Uint8ClampedArray([200, 100, 50, 128, 0, 0, 0, 255]);
    const fake = createFakeCanvas(pixels);

    const result = await createBrowserPixelDecoder(() =>
      environment(bitmap, fake.asCanvas()),
    ).decode(file);

    expect(result).toEqual({ width: 2, height: 1, pixels });
    expect(result.pixels).toBe(pixels);
  });

  it("draws the whole bitmap at (0, 0) on a canvas of the same size", async () => {
    const { bitmap } = createFakeBitmap(3, 2);
    const fake = createFakeCanvas(new Uint8ClampedArray(3 * 2 * 4));

    await createBrowserPixelDecoder(() =>
      environment(bitmap, fake.asCanvas()),
    ).decode(file);

    expect(fake.canvas.width).toBe(3);
    expect(fake.canvas.height).toBe(2);
    expect(fake.canvas.getContext).toHaveBeenCalledWith("2d", {
      willReadFrequently: true,
    });
    expect(fake.ctx.drawImage).toHaveBeenCalledWith(bitmap, 0, 0);
    expect(fake.ctx.getImageData).toHaveBeenCalledWith(0, 0, 3, 2);
  });

  it("closes the bitmap after reading the pixels", async () => {
    const { bitmap, close } = createFakeBitmap(1, 1);
    const fake = createFakeCanvas(new Uint8ClampedArray(4));

    await createBrowserPixelDecoder(() =>
      environment(bitmap, fake.asCanvas()),
    ).decode(file);

    expect(close).toHaveBeenCalledOnce();
  });

  it("throws a clear error and closes the bitmap if the 2D canvas cannot be created", async () => {
    const { bitmap, close } = createFakeBitmap(5000, 4000);
    const fake = createFakeCanvas(null);

    await expect(
      createBrowserPixelDecoder(() =>
        environment(bitmap, fake.asCanvas()),
      ).decode(file),
    ).rejects.toThrow(
      "Could not create a 5000×4000 px 2D canvas to read the image pixels.",
    );
    expect(close).toHaveBeenCalledOnce();
  });

  it("throws ExactDecodingUnsupportedError if createImageBitmap is missing", async () => {
    const fake = createFakeCanvas(new Uint8ClampedArray(4));

    await expect(
      createBrowserPixelDecoder(() => ({
        createImageBitmap: undefined,
        createCanvas: fake.asCanvas,
      })).decode(file),
    ).rejects.toBeInstanceOf(ExactDecodingUnsupportedError);
  });
});
