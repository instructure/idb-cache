import { test, expect } from "@playwright/test";

async function retryClickAndCheckTestIdText(
  page,
  buttonTestId,
  valueTestId,
  expectedText,
  retries = 10,
  delay = 500
) {
  for (let i = 0; i < retries; i++) {
    await page.getByTestId(buttonTestId).click();
    const text = await page.getByTestId(valueTestId).textContent();
    if (text?.includes(expectedText)) {
      expect(text).toContain(expectedText); // Assert condition
      return;
    }
    await page.waitForTimeout(delay);
  }
  throw new Error(
    `Text "${expectedText}" not found in "${valueTestId}" after ${retries} retries.`
  );
}

test("maxChunks and cleanup", async ({ page }) => {
  await page.goto("http://localhost:3000/#size=32");
  await page.getByLabel("Max total chunks:").dblclick();
  await page.getByLabel("Max total chunks:").fill("100");
  await page.getByLabel("Item size (KiB): *").fill("1200");
  await page.goto("http://localhost:3000/#size=1200");
  await page.getByLabel("Item size (KiB): *").press("ArrowLeft");
  await page.getByLabel("Item size (KiB): *").press("ArrowLeft");
  await page.getByLabel("Item size (KiB): *").press("Shift+ArrowLeft");
  await page.getByLabel("Item size (KiB): *").fill("1300");
  await page.goto("http://localhost:3000/#size=1300");
  await page.getByTestId("set-item-button").click();
  await retryClickAndCheckTestIdText(page, "count-button", "count-value", "52");
  await page.getByTestId("set-item-button").click();
  await retryClickAndCheckTestIdText(
    page,
    "count-button",
    "count-value",
    "104"
  );
  await page.getByTestId("cleanup-button").click();
  await retryClickAndCheckTestIdText(page, "count-button", "count-value", "52");
});
