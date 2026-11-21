import { describe, expect, it } from "vitest";
import { cssColor, formatDelta, formatHex, formatPercent, formatTuple } from "./format";

describe("formatHex", () => {
  it.each([
    [{ r: 0, g: 0, b: 0 }, "#000000"],
    [{ r: 255, g: 255, b: 255 }, "#FFFFFF"],
    [{ r: 1, g: 171, b: 15 }, "#01AB0F"],
  ])("formats RGB %o as %s", (color, expected) => {
    expect(formatHex(color)).toBe(expected);
  });

  it.each([
    [0, "#102030 000"],
    [7, "#102030 007"],
    [255, "#102030 255"],
  ])("pads alpha %i to three digits", (a, expected) => {
    expect(formatHex({ r: 16, g: 32, b: 48, a })).toBe(expected);
  });
});

describe("formatTuple", () => {
  it("lists RGB and RGBA values", () => {
    expect(formatTuple({ r: 1, g: 2, b: 3 })).toBe("(1, 2, 3)");
    expect(formatTuple({ r: 1, g: 2, b: 3, a: 0 })).toBe("(1, 2, 3, 0)");
  });
});

describe("cssColor", () => {
  it("uses rgb() and maps alpha 0–255 to 0–1", () => {
    expect(cssColor({ r: 10, g: 20, b: 30 })).toBe("rgb(10 20 30)");
    expect(cssColor({ r: 10, g: 20, b: 30, a: 0 })).toBe("rgb(10 20 30 / 0)");
    expect(cssColor({ r: 10, g: 20, b: 30, a: 255 })).toBe("rgb(10 20 30 / 1)");
    expect(cssColor({ r: 10, g: 20, b: 30, a: 128 })).toBe("rgb(10 20 30 / 0.501961)");
  });
});

describe("formatPercent", () => {
  it("always shows six decimals", () => {
    expect(formatPercent(0)).toBe("0.000000%");
    expect(formatPercent(100)).toBe("100.000000%");
    expect(formatPercent(12.3456789)).toBe("12.345679%");
  });
});

describe("formatDelta", () => {
  it.each([
    [0, "täpne"],
    [0.000499, "täpne"],
    [-0.000499, "täpne"],
    [0.0006, "0.001"],
    [0.0123, "0.012"],
  ])("%s → %s", (v, out) => expect(formatDelta(v, "täpne")).toBe(out));
});
