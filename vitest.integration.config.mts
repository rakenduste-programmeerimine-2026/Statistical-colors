import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Integration and database tests. They need local Supabase, so CI skips them.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    passWithNoTests: true,
    restoreMocks: true,
  },
});
