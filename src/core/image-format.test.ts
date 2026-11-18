import { describe, expect, it } from "vitest";
import { detectImageFormat, IMAGE_FORMATS } from "./image-format";

function bytes(...values: number[]): Uint8Array {
  return new Uint8Array(values);
}

function ascii(text: string): number[] {
  return Array.from(text, (char) => char.charCodeAt(0));
}

describe("detectImageFormat", () => {
  it("detects PNG", () => {
    expect(
      detectImageFormat(
        bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00),
      ),
    ).toBe("png");
  });

  it("detects JPEG", () => {
    expect(detectImageFormat(bytes(0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10))).toBe(
      "jpeg",
    );
  });

  it("detects GIF87a", () => {
    expect(detectImageFormat(bytes(...ascii("GIF87a"), 0x01, 0x00))).toBe(
      "gif",
    );
  });

  it("detects GIF89a", () => {
    expect(detectImageFormat(bytes(...ascii("GIF89a"), 0x01, 0x00))).toBe(
      "gif",
    );
  });

  it("detects WebP", () => {
    expect(
      detectImageFormat(
        bytes(...ascii("RIFF"), 0x24, 0x00, 0x00, 0x00, ...ascii("WEBPVP8 ")),
      ),
    ).toBe("webp");
  });

  it("detects BMP", () => {
    expect(detectImageFormat(bytes(...ascii("BM"), 0x36, 0x00, 0x00, 0x00))).toBe(
      "bmp",
    );
  });

  it("does not treat other RIFF files (e.g. WAV) as WebP", () => {
    expect(
      detectImageFormat(
        bytes(...ascii("RIFF"), 0x24, 0x00, 0x00, 0x00, ...ascii("WAVEfmt ")),
      ),
    ).toBeNull();
  });

  it("returns null for an unknown file", () => {
    expect(detectImageFormat(bytes(...ascii("%PDF-1.7")))).toBeNull();
  });

  it("returns null for TIFF, which browsers cannot decode", () => {
    expect(detectImageFormat(bytes(0x49, 0x49, 0x2a, 0x00))).toBeNull();
    expect(detectImageFormat(bytes(0x4d, 0x4d, 0x00, 0x2a))).toBeNull();
  });

  it("returns null for an empty file", () => {
    expect(detectImageFormat(new Uint8Array(0))).toBeNull();
  });

  it("returns null for a file shorter than the signature", () => {
    expect(detectImageFormat(bytes(0x89, 0x50, 0x4e, 0x47))).toBeNull();
    expect(detectImageFormat(bytes(0xff, 0xd8))).toBeNull();
    expect(detectImageFormat(bytes(...ascii("GIF8")))).toBeNull();
    expect(detectImageFormat(bytes(...ascii("RIFF"), 0x24, 0x00))).toBeNull();
    expect(detectImageFormat(bytes(0x42))).toBeNull();
  });

  it("only returns values allowed by the images.format column", () => {
    expect([...IMAGE_FORMATS].sort()).toEqual(
      ["bmp", "gif", "jpeg", "png", "webp"],
    );
  });
});
