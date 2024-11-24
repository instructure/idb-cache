import { test, expect } from "@playwright/test";

test("bail on setItem when item itself exceeds maxChunks", async ({ page }) => {
  await page.goto("http://localhost:3000/#size=32");
  await page.getByTestId("reset-cacheKey").click();
  await page.getByTestId("clear-button").click();
  await page.getByTestId("count-button").click();
  await expect(page.getByTestId("count-value")).toContainText("0");
  await page.getByTestId("max-chunks-input").click();
  await page.getByTestId("max-chunks-input").press("ControlOrMeta+a");
  await page.getByTestId("max-chunks-input").fill("5");
  await page.getByTestId("item-size-input").click();
  await page.getByTestId("item-size-input").press("ControlOrMeta+a");
  await page.getByTestId("item-size-input").fill("3");
  await page.goto("http://localhost:3000/#size=3");
  await page.getByTestId("item-size-input").fill("32");
  await page.goto("http://localhost:3000/#size=32");
  await page.getByTestId("item-size-input").fill("320");
  await page.goto("http://localhost:3000/#size=320");
  await page.getByTestId("item-size-input").fill("3200");
  await page.goto("http://localhost:3000/#size=3200");
  await page.getByTestId("set-item-button").click();
  await expect(page.getByTestId("hash1").locator("span")).toContainText(
    "------"
  );
  await page.getByTestId("count-button").click();
  await expect(page.getByTestId("count-value")).toContainText("0");
  await page.getByTestId("get-item-button").click();
  await expect(page.getByTestId("hash2").locator("span")).toContainText(
    "------"
  );
});
