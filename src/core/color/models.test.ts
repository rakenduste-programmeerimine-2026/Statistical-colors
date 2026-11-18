import { describe, expect, it } from "vitest";
import { hsvHueToRyb, modelHue, rybHueToHsv, toHsl, toHsv, toHwb, wheelColor } from "./models";

describe("colour model hues", () => {
  it.each([
    [{ r: 255, g: 0, b: 0 }, 0],
    [{ r: 255, g: 255, b: 0 }, 60],
    [{ r: 0, g: 255, b: 0 }, 120],
    [{ r: 0, g: 255, b: 255 }, 180],
    [{ r: 0, g: 0, b: 255 }, 240],
    [{ r: 255, g: 0, b: 255 }, 300],
  ])("gives %j the HSL and HSV hue %i", (rgb, h) => {
    expect(toHsl(rgb).h).toBeCloseTo(h, 9);
    expect(toHsv(rgb).h).toBeCloseTo(h, 9);
  });

  it("gives greys no hue in any model", () => {
    for (const model of ["hsl", "hsv", "hwb", "ryb"] as const) expect(modelHue(model, { r: 90, g: 90, b: 90 })).toBeNull();
  });

  it("reports HSL lightness and saturation, HSV value, and HWB whiteness and blackness", () => {
    expect(toHsl({ r: 255, g: 128, b: 0 })).toMatchObject({ s: 1, l: expect.closeTo(0.5, 9) });
    expect(toHsv({ r: 128, g: 0, b: 0 })).toMatchObject({ s: 1, l: expect.closeTo(128 / 255, 9) });
    expect(toHwb({ r: 255, g: 51, b: 51 })).toMatchObject({ s: 0, l: expect.closeTo(0.2, 9) });
  });
});

describe("RYB wheel", () => {
  it.each([
    [0, 0],
    [30, 60],
    [60, 120],
    [120, 180],
    [240, 240],
    [270, 300],
  ])("maps HSV hue %i to RYB hue %i and back", (hsv, ryb) => {
    expect(hsvHueToRyb(hsv)).toBeCloseTo(ryb, 9);
    expect(rybHueToHsv(ryb)).toBeCloseTo(hsv, 9);
  });

  it("puts green opposite red, as artists' wheels do", () => {
    expect(modelHue("ryb", { r: 0, g: 255, b: 0 })).toBeCloseTo(180, 9);
  });
});

describe("wheelColor", () => {
  it("draws each model's wheel at full saturation", () => {
    expect(wheelColor("hsl", 120)).toEqual({ r: 0, g: 255, b: 0 });
    // Yellow sits at 120° on the RYB wheel.
    expect(wheelColor("ryb", 120)).toEqual({ r: 255, g: 255, b: 0 });
  });
});
