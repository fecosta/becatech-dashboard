import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// DB-backed integration tests. Requires Docker Postgres running; the global setup
// creates + migrates a dedicated test database (TEST_DATABASE_URL).
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    include: ["tests/integration/**/*.test.ts"],
    environment: "node",
    globalSetup: ["./vitest.integration.globalSetup.ts"],
    setupFiles: ["./vitest.integration.setup.ts"],
    fileParallelism: false,
    hookTimeout: 60_000,
    testTimeout: 60_000,
  },
});
