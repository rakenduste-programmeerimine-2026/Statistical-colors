// Builds the Figma plugin with plain tsc and no bundler (P-023 item 7).
// Figma loads code.js as one classic script and ui.html as one HTML string, so
// the compiled modules are joined here: their import lines are dropped (every
// import is either type-only or of logic.ts, which is included first) and
// `export` keywords are removed. Each output runs inside one function scope.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const tmp = join(here, ".build");
const dist = join(here, "dist");

rmSync(tmp, { recursive: true, force: true });
execFileSync(process.execPath, [join(here, "../node_modules/typescript/bin/tsc"), "-p", join(here, "tsconfig.json"), "--outDir", tmp], { stdio: "inherit" });

/** One compiled module without its imports and exports. */
function unmodule(js) {
  return js
    .replace(/^import\s[^;]*;\s*$/gm, "")
    .replace(/^export \{\};\s*$/gm, "")
    .replace(/^export (?=(async )?function |const |let |class )/gm, "");
}

// rootDir is the repo root, because the scene types live in extension/.
const read = (name) => unmodule(readFileSync(join(tmp, "figma-plugin", "src", `${name}.js`), "utf8"));
const logic = read("logic");
const code = `(function () {\n${logic}\n${read("code")}\nstart();\n})();\n`;
// Inside an HTML <script>, "</script" would end the element early.
const ui = `(function () {\n${logic}\n${read("ui")}\nstartUi();\n})();\n`.replace(/<\/script/gi, "<\\/script");
for (const out of [code, ui]) {
  if (/^\s*(import|export)\s/m.test(out)) throw new Error("A module statement is left in the plugin output.");
}

mkdirSync(dist, { recursive: true });
writeFileSync(join(dist, "code.js"), code);
writeFileSync(join(dist, "ui.html"), readFileSync(join(here, "ui.html"), "utf8").replace("/* UI_SCRIPT */", () => ui));
rmSync(tmp, { recursive: true, force: true });
console.log("Built figma-plugin/dist/code.js and dist/ui.html");
