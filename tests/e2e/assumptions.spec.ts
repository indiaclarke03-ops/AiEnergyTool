import { expect, test } from "@playwright/test";

test("assumptions browser lists, searches and overrides", async ({ page }) => {
  await page.goto("/#/assumptions");
  await expect(page.getByTestId("unverified-badge")).toContainText("unverified");
  const table = page.getByTestId("assumptions-table");
  await page.getByLabel("Search assumptions").fill("PUE");
  await expect(table).toContainText("pue.hyperscale");
  await page.getByLabel("Power usage effectiveness — hyperscale central").fill("1.2");
  await expect(table).toContainText("overridden");
  await page.getByRole("button", { name: /Reset all/ }).click();
  await expect(table).not.toContainText("overridden");
});
