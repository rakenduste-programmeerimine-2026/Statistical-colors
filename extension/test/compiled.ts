import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";

/**
 * A source file as tsc emits it for Chrome (target ES2022), not as Vitest
 * transforms it. Imports resolve to empty objects: page functions must not use
 * them, so a function that does fails when it runs.
 */
export function compiled<T>(relativePath: string): T {
  const source = readFileSync(resolve(__dirname, relativePath), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  });
  const exports = {};
  new Function("exports", "require", outputText)(exports, () => ({}));
  return exports as T;
}

/** Rebuilds a function from its source text alone, as Chrome's executeScript does. */
export function fromSource<F extends (...args: never[]) => unknown>(fn: F): F {
  return new Function(`return (${fn.toString()})`)() as F;
}
