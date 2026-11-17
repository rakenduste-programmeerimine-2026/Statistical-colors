import {
  ExactDecodingUnsupportedError,
  type PixelDecoder,
  type RawPixels,
} from "./pixel-decoder";

export interface BrowserPixelDecoderEnvironment {
  createImageBitmap?: (
    image: Blob,
    options: ImageBitmapOptions,
  ) => Promise<ImageBitmap>;
  createCanvas: () => HTMLCanvasElement;
}

function defaultEnvironment(): BrowserPixelDecoderEnvironment {
  return {
    createImageBitmap:
      typeof globalThis.createImageBitmap === "function"
        ? (image, options) => globalThis.createImageBitmap(image, options)
        : undefined,
    createCanvas: () => document.createElement("canvas"),
  };
}

/**
 * Browsers silently ignore unknown `createImageBitmap` options, so a
 * try/catch cannot tell whether they were applied. WebIDL dictionary
 * conversion reads every member the browser knows about, so getters reveal
 * whether these options are understood.
 */
function createExactBitmapOptions() {
  let readColorSpaceConversion = false;
  let readPremultiplyAlpha = false;

  const options: ImageBitmapOptions = {
    get colorSpaceConversion() {
      readColorSpaceConversion = true;
      return "none" as const;
    },
    get premultiplyAlpha() {
      readPremultiplyAlpha = true;
      return "none" as const;
    },
  };

  return {
    options,
    wereHonoured: () => readColorSpaceConversion && readPremultiplyAlpha,
  };
}

function readPixelsWithCanvas2D(
  bitmap: ImageBitmap,
  env: BrowserPixelDecoderEnvironment,
): RawPixels {
  const { width, height } = bitmap;
  const canvas = env.createCanvas();
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    throw new Error(
      `Could not create a ${width}×${height} px 2D canvas to read the image pixels.`,
    );
  }
  ctx.drawImage(bitmap, 0, 0);
  const { data } = ctx.getImageData(0, 0, width, height);
  return { width, height, pixels: data };
}

/**
 * Browser adapter for {@link PixelDecoder}: decodes with `createImageBitmap`
 * (no colour conversion, no premultiplied alpha) and reads the pixels with
 * a 2D canvas `getImageData`.
 */
export function createBrowserPixelDecoder(
  getEnvironment: () => BrowserPixelDecoderEnvironment = defaultEnvironment,
): PixelDecoder {
  return {
    async decode(file) {
      const env = getEnvironment();
      if (!env.createImageBitmap) {
        throw new ExactDecodingUnsupportedError(
          "This browser does not support createImageBitmap.",
        );
      }

      const { options, wereHonoured } = createExactBitmapOptions();
      const bitmap = await env.createImageBitmap(file, options);
      try {
        if (!wereHonoured()) {
          throw new ExactDecodingUnsupportedError();
        }
        return readPixelsWithCanvas2D(bitmap, env);
      } finally {
        bitmap.close();
      }
    },
  };
}

export const browserPixelDecoder: PixelDecoder = createBrowserPixelDecoder();
