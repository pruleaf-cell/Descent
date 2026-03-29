import { defineConfig } from "vitest/config";
import { workspaceAliases } from "../../vitest.aliases.ts";

export default defineConfig({
  resolve: {
    alias: workspaceAliases
  },
  test: {
    globals: true,
    environment: "node"
  }
});
