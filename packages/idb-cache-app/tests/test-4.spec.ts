import { test, expect } from "@playwright/test";

test("20mb size item", async ({ page }) => {
  await page.goto("http://localhost:3000/#size=20480");
  await page.getByTestId("reset-cacheBuster").click();
  await page.getByTestId("clear-button").click();
  await page.getByTestId("set-item-button").click();
  await expect(page.getByText("6u81xr")).toBeVisible();
  await page.getByTestId("get-item-button").click();
  await expect(page.getByTestId("hash2").getByText("6u81xr")).toBeVisible();
  await page.getByTestId("count-button").click();
  await expect(page.getByText("839")).toBeVisible();
});
