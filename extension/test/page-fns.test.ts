import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { afterEach, describe, expect, it } from "vitest";
import type * as PageFns from "../src/core/page-fns.ts";

/** page-fns.ts as tsc emits it for Chrome (target ES2022), not as Vitest transforms it. */
function compiled(): typeof PageFns {
  const source = readFileSync(resolve(__dirname, "../src/core/page-fns.ts"), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  });
  const exports = {};
  new Function("exports", outputText)(exports);
  return exports as typeof PageFns;
}
const fns = compiled();

/**
 * Chrome sends these functions to the page as source text. Rebuilding each one
 * from its source proves it needs nothing from this module: a stray import or
 * closure would throw a ReferenceError here.
 */
function fromSource<F extends (...args: never[]) => unknown>(fn: F): F {
  return new Function(`return (${fn.toString()})`)() as F;
}

afterEach(() => {
  document.body.innerHTML = "";
  document.getElementById("cap-style")?.remove();
});

describe("page functions run from their source text", () => {
  it("pageInfo", () => {
    const info = fromSource(fns.pageInfo)();
    expect(info).toMatchObject({ url: location.href, vw: innerWidth, vh: innerHeight, dpr: devicePixelRatio });
    expect(info.docW).toBeGreaterThanOrEqual(info.vw);
  });

  it("settle", async () => {
    await expect(fromSource(fns.settle)()).resolves.toBe(true);
  });

  it("boxes gives four numbers per element", () => {
    document.body.innerHTML = "<div><span></span></div>";
    expect(fromSource(fns.boxes)()).toHaveLength(8);
  });

  it("injectStyle and removeStyle", () => {
    fromSource(fns.injectStyle)("cap-style", "body { color: red }");
    fromSource(fns.injectStyle)("cap-style", "body { color: blue }");
    const styles = document.querySelectorAll("#cap-style");
    expect(styles).toHaveLength(1);
    expect(styles[0].textContent).toBe("body { color: blue }");
    fromSource(fns.removeStyle)("cap-style");
    expect(document.getElementById("cap-style")).toBeNull();
  });

  it("readPalette, listRasterTargets and fontFamilies", () => {
    document.body.innerHTML = '<p style="color: rgb(1, 2, 3); font-family: \'Inter\', sans-serif">x</p><canvas></canvas>';
    // jsdom lays nothing out, so every box is 0 × 0 and is skipped as invisible.
    expect(fromSource(fns.readPalette)()).toEqual({ colours: [], soft: [] });
    expect(fromSource(fns.listRasterTargets)()).toEqual([]);
    expect(fromSource(fns.fontFamilies)()).toEqual(expect.arrayContaining(["Inter", "sans-serif"]));
  });
});
