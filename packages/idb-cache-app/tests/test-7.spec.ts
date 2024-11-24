import { test, expect } from "@playwright/test";

test("low priority", async ({ page }) => {
  await page.goto("http://localhost:3000/#size=32");
  await page.getByTestId("clear-button").click();
  await page.getByTestId("count-button").click();
  await expect(page.getByTestId("count-value")).toContainText("0");
  await page.getByTestId("priority-input").getByText("Low").click();
  await page.getByTestId("set-item-button").click();
  await expect(page.getByTestId("hash1")).toContainText("nrhzjl");
  await page.getByTestId("get-item-button").click();
  await expect(page.getByTestId("hash2")).toContainText("nrhzjl");
});
