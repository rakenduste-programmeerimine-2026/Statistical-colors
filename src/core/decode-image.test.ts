import { describe, expect, it, vi } from "vitest";
import {
  decodeImage,
  ExactDecodingUnsupportedError,
  UnsupportedImageFormatError,
  type PixelDecoder,
} from "./decode-image";

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function pngFile(): Blob {
  return new Blob([new Uint8Array([...PNG_SIGNATURE, 0, 0, 0, 0])], {
    type: "image/png",
  });
}

function fakeDecoder(result: Awaited<ReturnType<PixelDecoder["decode"]>>) {
  return { decode: vi.fn().mockResolvedValue(result) } satisfies PixelDecoder;
}

describe("decodeImage", () => {
  it("returns size, format and the decoder's pixels unchanged", async () => {
    // 2×1 image; the first pixel is semi-transparent.
    const pixels = new Uint8ClampedArray([200, 100, 50, 128, 0, 0, 0, 255]);
    const decoder = fakeDecoder({ width: 2, height: 1, pixels });
    const file = pngFile();

    const result = await decodeImage(file, decoder);

    expect(result).toEqual({ width: 2, height: 1, format: "png", pixels });
    expect(result.pixels).toBe(pixels);
    expect(decoder.decode).toHaveBeenCalledWith(file);
  });

  it("detects the format from the content, not the MIME type", async () => {
    const decoder = fakeDecoder({
      width: 1,
      height: 1,
      pixels: new Uint8ClampedArray(4),
    });
    const gif = new Blob(["GIF89a\x01\x00\x01\x00"], { type: "image/png" });

    await expect(decodeImage(gif, decoder)).resolves.toMatchObject({
      format: "gif",
    });
  });

  it("rejects an unsupported format without calling the decoder", async () => {
    const decoder = fakeDecoder({
      width: 1,
      height: 1,
      pixels: new Uint8ClampedArray(4),
    });
    const tiff = new Blob([new Uint8Array([0x49, 0x49, 0x2a, 0x00, 0, 0, 0, 0])]);

    await expect(decodeImage(tiff, decoder)).rejects.toBeInstanceOf(
      UnsupportedImageFormatError,
    );
    expect(decoder.decode).not.toHaveBeenCalled();
  });

  it("rejects an empty file", async () => {
    const decoder = fakeDecoder({
      width: 1,
      height: 1,
      pixels: new Uint8ClampedArray(4),
    });

    await expect(decodeImage(new Blob([]), decoder)).rejects.toBeInstanceOf(
      UnsupportedImageFormatError,
    );
  });

  it("propagates ExactDecodingUnsupportedError from the decoder", async () => {
    const decoder: PixelDecoder = {
      decode: vi.fn().mockRejectedValue(new ExactDecodingUnsupportedError()),
    };

    await expect(decodeImage(pngFile(), decoder)).rejects.toBeInstanceOf(
      ExactDecodingUnsupportedError,
    );
  });

  it("rejects a decoder result whose pixel buffer does not match the size", async () => {
    const decoder = fakeDecoder({
      width: 2,
      height: 2,
      pixels: new Uint8ClampedArray(4),
    });

    await expect(decodeImage(pngFile(), decoder)).rejects.toThrow(
      /expected 16/,
    );
  });
});
