import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(root, "..");
const localNode = path.join(projectRoot, ".tools", "node", "bin", "node");
const localPnpm = path.join(projectRoot, ".tools", "node", "bin", "corepack");

if (!existsSync(localNode)) {
  console.error("Local Node toolchain not found. Install the repo-local toolchain in .tools/node before running bootstrap.");
  process.exit(1);
}

const env = {
  ...process.env,
  PATH: `${path.join(projectRoot, ".tools", "bin")}:${path.join(projectRoot, ".tools", "node", "bin")}:${process.env.PATH ?? ""}`
};

for (const args of [["pnpm", "install"], ["pnpm", "db:migrate"], ["pnpm", "db:seed"]]) {
  const [command, ...rest] = args;
  const result = spawnSync(localPnpm, [command, ...rest], {
    cwd: projectRoot,
    stdio: "inherit",
    env
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

