import { expect, test } from "@playwright/test";

test("metered chat uses exact usage from the proxy (proxy mocked)", async ({ page }) => {
  await page.route("**/api/providers", (r) =>
    r.fulfill({ json: { anthropic: { configured: true, defaultModel: "claude-opus-5-5" }, openai: { configured: false, defaultModel: "gpt-4o-mini" } } }),
  );
  await page.route("**/api/chat", (r) =>
    r.fulfill({ json: { text: "Paris.", model: "claude-opus-5-5", usage: { inputTokens: 1234, outputTokens: 56, reasoningTokens: 789 } } }),
  );
  await page.goto("/#/receipt");
  await page.getByRole("tab", { name: "Metered chat" }).click();
  await page.getByLabel("Message").fill("Capital of France?");
  await page.getByRole("button", { name: "Send" }).click();
  const chat = page.getByTestId("metered-chat");
  await expect(chat).toContainText("Paris.");
  await expect(chat).toContainText("1234 in · 56 out · 789 reasoning");
  const card = page.getByTestId("receipt-card");
  await expect(card).toContainText("1,234 in · 56 out · 789 reasoning");
  await expect(card).toContainText("exact (metered)");
});

test("metered chat explains when the proxy is not running", async ({ page }) => {
  await page.route("**/api/providers", (r) => r.fulfill({ status: 502, body: "" }));
  await page.goto("/#/receipt");
  await page.getByRole("tab", { name: "Metered chat" }).click();
  await expect(page.getByRole("status")).toContainText("npm run server");
});
