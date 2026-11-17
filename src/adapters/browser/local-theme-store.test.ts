import { describe, expect, it } from "vitest";
import { DEFAULT_THEME_STATE, addTheme } from "@/core/theme/theme";
import { LocalThemeStore } from "./local-theme-store";

function memoryStorage(initial?: string) {
  const data = new Map<string, string>(initial ? [["statistical-colors:themes", initial]] : []);
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
}

describe("LocalThemeStore", () => {
  it("starts with the default theme", async () => {
    expect(await new LocalThemeStore(() => memoryStorage()).load()).toEqual(DEFAULT_THEME_STATE);
  });

  it("saves and loads themes across instances", async () => {
    const storage = memoryStorage();
    const state = addTheme(DEFAULT_THEME_STATE, "#000000", "#ffffff");
    await new LocalThemeStore(() => storage).save(state);
    expect(await new LocalThemeStore(() => storage).load()).toEqual(state);
  });

  it("falls back to the default for corrupt data", async () => {
    expect(await new LocalThemeStore(() => memoryStorage("{not json")).load()).toEqual(DEFAULT_THEME_STATE);
  });

  it("keeps working in memory when storage throws", async () => {
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    const store = new LocalThemeStore(() => broken);
    const state = addTheme(DEFAULT_THEME_STATE, "#000000", "#ffffff");
    await store.save(state);
    expect(await store.load()).toEqual(state);
  });

  it("works when there is no storage at all", async () => {
    expect(await new LocalThemeStore(() => undefined).load()).toEqual(DEFAULT_THEME_STATE);
  });
});
