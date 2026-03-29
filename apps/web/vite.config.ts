import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@descent/shared": path.resolve(rootDir, "../../packages/shared/src/index.ts")
    }
  },
  server: {
    port: 5173
  }
});
