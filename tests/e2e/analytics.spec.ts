import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

test("research dashboard: sessions, comparisons, scenarios, sensitivity, disclosures, exports", async ({ page }) => {
  // Save a receipt first.
  await page.goto("/#/receipt");
  await page.getByRole("button", { name: "Save to session" }).click();
  await expect(page.getByRole("status")).toContainText("Saved");

  await page.goto("/#/analytics");
  await expect(page.getByTestId("sessions-table").locator("tbody tr")).toHaveCount(1);
  await page.getByLabel("Reasoning").selectOption("true");
  await expect(page.getByTestId("sessions-table").locator("tbody tr")).toHaveCount(0);
  await page.getByLabel("Reasoning").selectOption("all");

  await expect(page.getByTestId("comparisons")).toContainText("Singapore");

  const unc = page.getByTestId("uncertainty");
  await expect(unc.getByTestId("chart")).toHaveCount(2);
  await expect(unc.getByTestId("mc-stats")).toContainText("p95");
  await unc.locator("#output-select").selectOption("costPerMTok");
  await expect(unc.getByTestId("mc-stats")).toContainText("$");

  await page.getByLabel("Scenario name").fill("Reference");
  await page.getByRole("button", { name: "Save current Cost Stack" }).click();
  await page.getByRole("checkbox", { name: "Reference" }).check();
  await expect(page.getByTestId("scenario-compare")).toContainText("$8.48B");

  const disc = page.getByTestId("disclosures");
  await expect(disc.getByLabel("Google — Provider")).toBeVisible();
  await expect(disc.locator("table")).not.toContainText(/\bnone\b/i);

  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download bundle" }).click()]);
  const snapshot = JSON.parse(readFileSync((await download.path())!, "utf8"));
  expect(snapshot.kind).toBe("ai-energy-lens/methodology-snapshot");
  expect(snapshot.receipts).toHaveLength(1);
  expect(Object.keys(snapshot.assumptions).length).toBeGreaterThan(40);
});
