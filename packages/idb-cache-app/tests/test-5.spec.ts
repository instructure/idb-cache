import { test, expect } from "@playwright/test";

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
  // ensures enough time for IDB to take effect
  await page.getByTestId("count-button").click();
  await page.getByTestId("count-button").click();
  await page.getByTestId("count-button").click();
  await page.getByTestId("count-button").click();
  await page.getByTestId("count-button").click();
  await page.getByTestId("count-button").click();
  await page.getByTestId("count-button").click();
  await page.getByTestId("count-button").click();
  await page.getByTestId("count-button").click();
  await page.getByTestId("count-button").click();
  await expect(page.getByText("52")).toBeVisible();
  await page.getByTestId("set-item-button").click();
  // ensures enough time for IDB to take effect
  await page.getByTestId("count-button").click();
  await page.getByTestId("count-button").click();
  await page.getByTestId("count-button").click();
  await page.getByTestId("count-button").click();
  await page.getByTestId("count-button").click();
  await expect(page.getByText("104")).toBeVisible();
  await page.getByTestId("cleanup-button").click();
  // ensures enough time for IDB to take effect
  await page.getByTestId("count-button").click();
  await page.getByTestId("count-button").click();
  await page.getByTestId("count-button").click();
  await page.getByTestId("count-button").click();
  await page.getByTestId("count-button").click();
  await expect(page.getByText("52")).toBeVisible();
});
