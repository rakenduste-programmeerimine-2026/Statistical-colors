import { describe, expect, it } from "vitest";
import {
  DEFAULT_THEME,
  DEFAULT_THEME_STATE,
  addTheme,
  currentTheme,
  isHex6,
  normalizeHex,
  parseThemeState,
  setCurrentTheme,
} from "./theme";

describe("normalizeHex", () => {
  it.each([
    ["#ABCDEF", "#abcdef"],
    ["abcdef", "#abcdef"],
    ["  #00ff00 ", "#00ff00"],
  ])("normalizes %s", (input, expected) => expect(normalizeHex(input, "#ffffff")).toBe(expected));

  it.each(["", "#fff", "#abcdefa", "#ggg000", "red", null, 123])("falls back for %o", (input) => {
    expect(normalizeHex(input, "#123456")).toBe("#123456");
  });
});

describe("isHex6", () => {
  it("needs a # and exactly six hex digits", () => {
    expect(isHex6("#a1B2c3")).toBe(true);
    expect(isHex6("a1b2c3")).toBe(false);
    expect(isHex6("#a1b2c")).toBe(false);
  });
});

describe("theme state", () => {
  it("adds a new theme and makes it current", () => {
    const state = addTheme(DEFAULT_THEME_STATE, "#000000", "#FFFFFF");
    expect(state.themes).toHaveLength(2);
    expect(currentTheme(state)).toEqual({ id: "#000000_#ffffff", bg: "#000000", text: "#ffffff" });
  });

  it("does not duplicate a theme saved twice", () => {
    const once = addTheme(DEFAULT_THEME_STATE, "#000000", "#ffffff");
    const twice = addTheme(setCurrentTheme(once, "default"), "#000000", "#ffffff");
    expect(twice.themes).toHaveLength(2);
    expect(twice.currentId).toBe("#000000_#ffffff");
  });

  it("ignores an unknown id when switching", () => {
    expect(setCurrentTheme(DEFAULT_THEME_STATE, "nope")).toBe(DEFAULT_THEME_STATE);
  });

  it("falls back to the first theme when the current id is missing", () => {
    expect(currentTheme({ currentId: "gone", themes: [DEFAULT_THEME] })).toBe(DEFAULT_THEME);
  });
});

describe("parseThemeState", () => {
  it.each([null, "x", {}, { themes: [] }, { themes: [{ id: "a", bg: "bad", text: "#000000" }] }])(
    "gives the default for %o",
    (raw) => expect(parseThemeState(raw)).toBe(DEFAULT_THEME_STATE),
  );

  it("keeps valid themes and drops broken ones", () => {
    const state = parseThemeState({
      currentId: "b",
      themes: [{ id: "a", bg: "#000000" }, { id: "b", bg: "#000000", text: "#ffffff" }],
    });
    expect(state).toEqual({ currentId: "b", themes: [{ id: "b", bg: "#000000", text: "#ffffff" }] });
  });
});
