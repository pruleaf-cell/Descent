import path from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = path.dirname(fileURLToPath(import.meta.url));

export const workspaceAliases = {
  "@descent/shared": path.join(workspaceRoot, "packages/shared/src/index.ts"),
  "@descent/game": path.join(workspaceRoot, "packages/game/src/index.ts"),
  "@descent/content": path.join(workspaceRoot, "packages/content/src/index.ts"),
  "@descent/assets": path.join(workspaceRoot, "packages/assets/src/index.ts")
} as const;

