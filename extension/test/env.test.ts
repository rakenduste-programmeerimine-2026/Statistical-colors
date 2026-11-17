import { describe, expect, it } from "vitest";
import { detectBrowser, envFrom } from "../src/env.ts";

const chromium = { brand: "Chromium", version: "142" };

describe("detectBrowser", () => {
  it.each([
    [[{ brand: "Google Chrome", version: "142" }, chromium], false, "chrome", "142"],
    [[{ brand: "Microsoft Edge", version: "141" }, chromium], false, "edge", "141"],
    [[{ brand: "Opera", version: "120" }, chromium], false, "opera", "120"],
    [[chromium], false, "other", "142"],
    [[chromium], true, "brave", "142"],
  ])("reads %j (brave: %s) as %s %s", (brands, isBrave, browser, version) => {
    expect(detectBrowser(brands, isBrave)).toEqual({ browser, browserVersion: version });
  });

  it("still reports Brave when it gives no Chromium brand", () => {
    expect(detectBrowser([], true)).toEqual({ browser: "brave", browserVersion: null });
  });

  it("knows nothing without brands", () => {
    expect(detectBrowser([], false)).toEqual({ browser: null, browserVersion: null });
  });
});

describe("envFrom", () => {
  const detected = { os: "win", arch: "x86-64", browser: "chrome", browserVersion: "142" };

  it("marks values as detected, chosen by the user, or unknown", () => {
    expect(envFrom({ os: "win", browser: "edge" }, detected)).toEqual({
      os: "win",
      browser: "edge",
      browserVersion: "142",
      arch: "x86-64",
      osSource: "detected",
      browserSource: "user",
    });
    expect(envFrom({ os: null, browser: null }, detected)).toMatchObject({ osSource: "unknown", browserSource: "unknown" });
  });

  it("counts a value as chosen by the user when nothing was detected", () => {
    const none = { os: null, arch: null, browser: null, browserVersion: null };
    expect(envFrom({ os: "linux", browser: "chrome" }, none)).toMatchObject({ osSource: "user", browserSource: "user" });
  });
});
