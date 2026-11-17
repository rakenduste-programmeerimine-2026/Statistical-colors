import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const manifest = JSON.parse(readFileSync(resolve(__dirname, "../manifest.json"), "utf8"));

describe("manifest", () => {
  it("lists debugger as a normal permission: Chrome refuses it as optional (P-027)", () => {
    expect(manifest.permissions).toContain("debugger");
    expect(manifest.optional_permissions ?? []).not.toContain("debugger");
  });

  it("points Chrome at the built files", () => {
    expect(manifest.background).toEqual({ service_worker: "dist/background.js", type: "module" });
    expect(manifest.manifest_version).toBe(3);
  });
});
