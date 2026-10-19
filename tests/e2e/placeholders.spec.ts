import { expect, test } from "@playwright/test";

for (const [hash, title] of [
  ["costStack", "Cost Stack Explorer"],
  ["analytics", "Research Dashboard"],
]) {
  test(`${title} page loads`, async ({ page }) => {
    await page.goto(`/#/${hash}`);
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
  });
}
