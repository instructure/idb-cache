import { test, expect } from "@playwright/test";

test("cache buster (1)", async ({ page }) => {
  await page.goto("http://localhost:3000/#size=32");
  await page.getByTestId("reset-cacheBuster").click();
  await page.getByTestId("clear-button").click();
  await page.getByTestId("count-button").click();
  await expect(page.getByTestId("count-value").getByText("0")).toBeVisible();
  await page.getByTestId("set-item-button").click();
  await expect(page.getByText("nrhzjl")).toBeVisible();
  await page.getByTestId("get-item-button").click();
  await expect(page.getByTestId("hash2").getByText("nrhzjl")).toBeVisible();
  await page.getByTestId("reset-cacheBuster").click();
  await page.getByTestId("cleanup-button").click();
  await page.getByTestId("count-button").click();
  await expect(page.getByTestId("count-value").getByText("0")).toBeVisible();
  await page.getByTestId("get-item-button").click();
  await expect(page.getByTestId("hash2").getByText("------")).toBeVisible();
  await page.getByTestId("set-item-button").click();
  await expect(page.getByText("nrhzjl")).toBeVisible();
  await page.getByTestId("get-item-button").click();
  await expect(page.getByTestId("hash2").getByText("nrhzjl")).toBeVisible();
  await page.getByTestId("count-button").click();
  await expect(page.getByTestId("count-value").getByText("2")).toBeVisible();
  await page.getByTestId("reset-cacheBuster").click();
  await page.getByTestId("cleanup-button").click();
  await page.getByTestId("get-item-button").click();
  await expect(
    page.getByTestId("hash2").locator("div").filter({ hasText: "------" })
  ).toBeVisible();
  await page.getByTestId("count-button").click();
  await expect(page.getByTestId("count-value").getByText("0")).toBeVisible();
});
