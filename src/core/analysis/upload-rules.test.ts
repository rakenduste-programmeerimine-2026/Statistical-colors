import { describe, expect, it } from "vitest";
import { MAX_UPLOAD_BYTES, TOP_N_DEFAULT, clampTopN, validateUpload } from "./upload-rules";

describe("validateUpload", () => {
  it("asks for a file when none is picked", () => {
    expect(validateUpload(null)).toBe("no-file");
    expect(validateUpload(undefined)).toBe("no-file");
    expect(validateUpload({ name: "", size: 10 })).toBe("no-file");
  });

  it.each(["a.png", "a.jpg", "a.jpeg", "a.bmp", "a.gif", "a.webp", "A.PNG", "my.photo.JpEg"])(
    "accepts %s",
    (name) => expect(validateUpload({ name, size: 1 })).toBeNull(),
  );

  it.each(["a.tiff", "a.tif", "a.svg", "a.txt", "png", "a.", ".png", "noext"])("rejects %s", (name) => {
    expect(validateUpload({ name, size: 1 })).toBe("type-not-allowed");
  });

  it("allows exactly 25 MB and rejects one byte more", () => {
    expect(validateUpload({ name: "a.png", size: MAX_UPLOAD_BYTES })).toBeNull();
    expect(validateUpload({ name: "a.png", size: MAX_UPLOAD_BYTES + 1 })).toBe("too-large");
  });
});

describe("clampTopN", () => {
  it.each([
    ["1", 1],
    ["5000", 5000],
    ["0", 1],
    ["-3", 1],
    ["5001", 5000],
    [" 42 ", 42],
    [42, 42],
    [41.9, 41],
  ])("clamps %o to %i", (input, expected) => {
    expect(clampTopN(input)).toBe(expected);
  });

  it.each(["", "abc", "12abc", "3.5", null, undefined, Number.NaN, Number.POSITIVE_INFINITY])(
    "falls back to the default for %o",
    (input) => expect(clampTopN(input)).toBe(TOP_N_DEFAULT),
  );

  it("uses the given fallback", () => {
    expect(clampTopN("x", 7)).toBe(7);
  });
});
