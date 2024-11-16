import { test, expect } from "@playwright/test";

test("test", async ({ page }) => {
  await page.goto("http://localhost:3000/");
  await page.getByRole("button", { name: "setItem" }).click();
  await page.getByRole("button", { name: "getItem" }).click();
  await page.getByRole("button", { name: "count" }).click();
  await page.getByRole("button", { name: "clear" }).click();
  await page.getByRole("button", { name: "count" }).click();
  await page.getByText("0", { exact: true }).click();
  await page.getByRole("button", { name: "getItem" }).click();
  await page.getByText("------").click();
  await page.getByRole("button", { name: "setItem" }).click();
});
