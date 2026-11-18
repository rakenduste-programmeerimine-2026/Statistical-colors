import type { Env } from "./core/pipeline.ts";

export const OS = [
  ["win", "Windows"],
  ["mac", "macOS"],
  ["linux", "Linux"],
  ["cros", "ChromeOS"],
  ["android", "Android"],
] as const;

export const BROWSERS = [
  ["chrome", "Chrome"],
  ["edge", "Edge"],
  ["brave", "Brave"],
  ["opera", "Opera"],
  ["other", "Other Chromium"],
] as const;

export interface Brand {
  brand: string;
  version: string;
}

export interface Detected {
  os: string | null;
  arch: string | null;
  browser: string | null;
  browserVersion: string | null;
}

/** The browser from User-Agent Client Hints brands. Brave hides its brand, so it is passed separately. */
export function detectBrowser(brands: Brand[], isBrave: boolean): Pick<Detected, "browser" | "browserVersion"> {
  const has = (re: RegExp) => brands.find((b) => re.test(b.brand));
  const hit = isBrave ? { brand: "Brave", version: "" } : has(/Edge/) || has(/Opera/) || has(/Google Chrome/) || has(/Chromium/);
  if (!hit) return { browser: null, browserVersion: null };
  const browser = /brave/i.test(hit.brand)
    ? "brave"
    : /Edge/.test(hit.brand)
      ? "edge"
      : /Opera/.test(hit.brand)
        ? "opera"
        : /Google Chrome/.test(hit.brand)
          ? "chrome"
          : "other";
  const browserVersion = hit.version || brands.find((b) => /Chromium/.test(b.brand))?.version || null;
  return { browser, browserVersion };
}

/** What goes into report.json: the ticked values, and whether each was detected or chosen by the user. */
export function envFrom(chosen: { os: string | null; browser: string | null }, detected: Detected): Env {
  const source = (value: string | null, found: string | null) => (value === null ? "unknown" : value === found ? "detected" : "user");
  return {
    os: chosen.os,
    browser: chosen.browser,
    browserVersion: detected.browserVersion,
    arch: detected.arch,
    osSource: source(chosen.os, detected.os),
    browserSource: source(chosen.browser, detected.browser),
  };
}
