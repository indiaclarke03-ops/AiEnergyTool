import { expect, test } from "@playwright/test";

test("receipt renders ranges, boundaries, sources and saves to a session", async ({ page }) => {
  await page.goto("/#/receipt");
  const card = page.getByTestId("receipt-card");
  await expect(card).toBeVisible();
  for (const line of ["energy", "carbon", "water", "energyCost", "fullCost"]) {
    await expect(card.getByTestId(`line-${line}`)).toBeVisible();
  }
  // Ranges: every line shows a low–high band.
  await expect(card.getByTestId("line-energy")).toContainText("–");
  await expect(card.getByTestId("boundary-facility").first()).toBeVisible();

  // Boundary switch updates the energy badge.
  await page.getByLabel("Energy boundary").selectOption("gpu_only");
  await expect(card.getByTestId("line-energy").getByTestId("boundary-gpu_only")).toBeVisible();

  // Source tooltip lists sourced assumptions.
  await card.getByTestId("line-energy").getByRole("button", { name: /Sources/ }).click();
  await expect(page.getByRole("dialog")).toContainText("Energy per output token");

  // Scale panel.
  await expect(page.getByTestId("scale-results")).toContainText("Wh");

  // Lever stacking.
  await page.getByRole("checkbox", { name: /FP8 quantization/ }).first().check();
  await expect(card).toContainText("with 1 lever applied");

  await card.getByRole("button", { name: "Save to session" }).click();
  await expect(card.getByRole("status")).toContainText("Saved");
});

test("paste mode counts tokens", async ({ page }) => {
  await page.goto("/#/receipt");
  await page.getByRole("tab", { name: "Paste conversation" }).click();
  await page.getByLabel(/Prompt/).fill("What is the capital of France?");
  await page.getByLabel("Response").fill("The capital of France is Paris.");
  await expect(page.getByTestId("paste-counts")).toContainText("input", { timeout: 15_000 });
  await expect(page.getByTestId("paste-counts")).toContainText("approximate for non-OpenAI models");
});
