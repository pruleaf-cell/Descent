import { defineConfig } from "vitest/config";
import { workspaceAliases } from "../../vitest.aliases.ts";

export default defineConfig({
  resolve: {
    alias: workspaceAliases
  },
  test: {
    globals: true,
    environment: "jsdom",
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    passWithNoTests: true,
    clearMocks: true,
    restoreMocks: true,
    testTimeout: 15000
  }
});
