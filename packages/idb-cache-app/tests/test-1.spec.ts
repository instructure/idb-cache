import { test, expect } from "@playwright/test";

test("basics", async ({ page }) => {
  await page.goto("http://localhost:3000/#size=32");
  await page.getByRole("button", { name: "clear" }).click();
  await page.getByRole("button", { name: "count" }).click();
  await page.getByText("0", { exact: true }).click();
  await page.getByRole("button", { name: "setItem" }).click();
  await page.getByText("1vz68t").click();
  await page.getByRole("button", { name: "getItem" }).click();
  await page.getByText("1vz68t").nth(1).click();
  await page.getByRole("button", { name: "setItem" }).click();
  await page.getByText("zczdo4").click();
  await page.getByRole("button", { name: "getItem" }).click();
  await page.getByText("zczdo4").nth(1).click();
  await page.getByRole("button", { name: "count" }).click();
  await page.getByText("4", { exact: true }).click();
  await page.getByRole("button", { name: "clear" }).click();
  await page.getByRole("button", { name: "count" }).click();
  await page.getByText("0", { exact: true }).click();
});
