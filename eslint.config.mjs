import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Uncommitted reference material (P-011) and built extension output.
    "claude-setup/**",
    // Unverified prototypes for the backend team (P-031 item 10), not app code.
    "prototypes/**",
    "extension/dist/**",
    "figma-plugin/dist/**",
    "figma-plugin/.build/**",
  ]),
]);

export default eslintConfig;
