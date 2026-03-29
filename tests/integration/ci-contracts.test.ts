import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const rootPackage = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
  scripts: Record<string, string>;
};

describe("repository automation contracts", () => {
  it("keeps the expected quality gate scripts in place", () => {
    const scripts = rootPackage.scripts;

    expect(scripts.bootstrap).toContain("scripts/bootstrap.mjs");
    expect(scripts.lint).toContain("turbo run lint");
    expect(scripts.typecheck).toContain("turbo run typecheck");
    expect(scripts.test).toContain("test:unit");
    expect(scripts.test).toContain("test:integration");
    expect(scripts["test:e2e"]).toContain("playwright test");
    expect(scripts.verify).toContain("content:validate");
    expect(scripts.verify).toContain("asset:validate");
    expect(scripts.verify).toContain("pnpm build");
  });

  it("publishes both CI and Playwright workflow files", () => {
    const ci = readFileSync(new URL("../../.github/workflows/ci.yml", import.meta.url), "utf8");
    const e2e = readFileSync(new URL("../../.github/workflows/e2e.yml", import.meta.url), "utf8");

    expect(ci).toContain("pnpm lint");
    expect(ci).toContain("pnpm typecheck");
    expect(ci).toContain("pnpm test");
    expect(ci).toContain("pnpm build");
    expect(ci).toContain("pnpm verify");
    expect(e2e).toContain("pnpm test:e2e");
    expect(e2e).toContain("playwright install");
  });
});
