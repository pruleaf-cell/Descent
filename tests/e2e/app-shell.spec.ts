import { expect, test } from "@playwright/test";

test.describe("Descent-inspired shell", () => {
  test("exposes the core mission controls and HUD panels", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByTestId("app-shell")).toBeVisible();
    await expect(page.getByTestId("mission-brief")).toBeVisible();
    await expect(page.getByTestId("hud")).toBeVisible();
    await expect(page.getByTestId("leaderboard-panel")).toBeVisible();
    await expect(page.getByTestId("flare-control")).toBeVisible();
  });
});

