import { test, expect } from "@playwright/test";

test("basics", async ({ page }) => {
  await page.goto("http://localhost:3000/#size=32");
  await page.getByTestId("reset-cacheBuster").click();
  await page.getByTestId("clear-button").click();
  await page.getByTestId("count-button").click();
  await expect(page.getByTestId("count-value")).toContainText("0");
  await expect(page.getByTestId("count-time")).toContainText("ms");
  await page.getByTestId("set-item-button").click();
  await expect(page.getByTestId("hash1")).toContainText("nrhzjl");
  await page.getByTestId("get-item-button").click();
  await expect(page.getByTestId("hash2")).toContainText("nrhzjl");
  await page.getByTestId("count-button").click();
  await expect(page.getByTestId("count-value")).toContainText("2");
  await page.getByTestId("set-item-button").click();
  await expect(page.getByTestId("hash1")).toContainText("2h0z7s");
  await page.getByTestId("get-item-button").click();
  await expect(page.getByTestId("hash2")).toContainText("2h0z7s");
});
