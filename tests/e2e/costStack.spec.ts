import { expect, test } from "@playwright/test";

test("cost stack: sliders, presets, charts, A↔B link and headline", async ({ page }) => {
  await page.goto("/#/costStack");
  await expect(page.getByRole("heading", { name: "Cost Stack Explorer" })).toBeVisible();
  const headline = page.getByTestId("headline");
  await expect(headline).toContainText("Energy share of total cost");
  await expect(headline).toContainText("Energy share of external impact");

  const kpis = page.getByTestId("kpis");
  await expect(kpis).toContainText("$8.48B");
  // Four ECharts charts render (waterfall, mix, utilization, sankey) as SVG.
  await expect(page.getByTestId("chart").locator("svg")).toHaveCount(4);

  // Slider moves TCO.
  await page.getByLabel("IT equipment lifespan (servers + network)").fill("3");
  await expect(kpis).not.toContainText("$8.48B");

  // Preset resets and applies.
  await page.getByRole("button", { name: "Epoch 1 GW reference" }).click();
  await expect(kpis).toContainText("$8.48B");
  await page.getByRole("button", { name: "Colocation tenant" }).click();
  await expect(page.locator("#slider-tco\\.opex\\.colocation")).not.toHaveValue("0");

  await page.getByLabel(/Public API price/).fill("10");
  await expect(page.getByTestId("price-ratio")).toContainText("×");
  await expect(page.getByTestId("drill")).toContainText("Your query");
});
