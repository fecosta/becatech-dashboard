import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

// Fast, DB-free unit tests (run with `npm test`). Integration tests live under
// tests/integration and run separately via `npm run test:integration`.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    exclude: [...configDefaults.exclude, "tests/integration/**"],
    environment: "node",
  },
});
