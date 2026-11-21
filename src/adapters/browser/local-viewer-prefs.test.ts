import { describe, expect, it } from "vitest";
import { memoryStorage } from "@/test/render";
import { CIE_GREY } from "@/core/viewer/viewer-prefs";
import { srgbToLab } from "@/core/color/lab";
import { LocalViewerPrefs } from "./local-viewer-prefs";

describe("LocalViewerPrefs (P-039 item 5)", () => {
  it("remembers each viewer's background across reloads", () => {
    const storage = memoryStorage();
    new LocalViewerPrefs(() => storage).setBackground("gamut", CIE_GREY);
    const reloaded = new LocalViewerPrefs(() => storage);
    expect(reloaded.background("gamut")).toBe(CIE_GREY);
    expect(reloaded.background("pixel")).toBeNull();
  });

  it("forgets a background when set back to the default", () => {
    const storage = memoryStorage();
    const prefs = new LocalViewerPrefs(() => storage);
    prefs.setBackground("pixel", "#000000");
    prefs.setBackground("pixel", null);
    expect(new LocalViewerPrefs(() => storage).background("pixel")).toBeNull();
  });

  it.each([["not json"], [JSON.stringify({ pixel: "red", gamut: "#12345" })], [JSON.stringify({ other: "#ffffff" })]])(
    "ignores unreadable or invalid saved data: %s",
    (raw) => {
      const prefs = new LocalViewerPrefs(() => ({ getItem: () => raw, setItem: () => {} }));
      expect(prefs.background("pixel")).toBeNull();
      expect(prefs.background("gamut")).toBeNull();
    },
  );

  it("still works for the visit when storage throws", () => {
    const prefs = new LocalViewerPrefs(() => ({
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    }));
    prefs.setBackground("gamut", "#1e1e1e");
    expect(prefs.background("gamut")).toBe("#1e1e1e");
  });
});

describe("CIE grey", () => {
  it("is the CIE L* 50 reference grey (CIE 116-1995), neutral", () => {
    const [L, a, b] = srgbToLab({ r: 0x77, g: 0x77, b: 0x77 });
    expect(L).toBeCloseTo(50, 0);
    expect(Math.abs(L - 50)).toBeLessThan(0.1);
    expect(Math.hypot(a, b)).toBeLessThan(0.02);
  });
});
