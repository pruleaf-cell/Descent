import { defineConfig } from "vitest/config";
import { workspaceAliases } from "../../vitest.aliases.ts";

export default defineConfig({
  resolve: {
    alias: workspaceAliases
  },
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.{test,spec}.ts"],
    exclude: ["src/**/*.integration.test.ts"],
    passWithNoTests: true,
    clearMocks: true,
    restoreMocks: true,
    testTimeout: 15000
  }
});
