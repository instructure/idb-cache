import { test, expect } from "@playwright/test";

test("maxChunks and cleanup", async ({ page }) => {
  await page.goto("http://localhost:3000/#size=32");
  await page.getByLabel("Max total chunks:").dblclick();
  await page.getByLabel("Max total chunks:").fill("100");
  await page.getByLabel("Size of item (KB): *").dblclick();
  await page.getByLabel("Size of item (KB): *").press("ControlOrMeta+a");
  await page.getByLabel("Size of item (KB): *").fill("5");
  await page.goto("http://localhost:3000/#size=5");
  await page.getByLabel("Size of item (KB): *").fill("50");
  await page.goto("http://localhost:3000/#size=50");
  await page.getByLabel("Size of item (KB): *").fill("500");
  await page.goto("http://localhost:3000/#size=500");
  await page.getByLabel("Size of item (KB): *").press("ControlOrMeta+a");
  await page.getByLabel("Size of item (KB): *").press("ArrowLeft");
  await page.getByLabel("Size of item (KB): *").press("Shift+ArrowRight");
  await page.getByLabel("Size of item (KB): *").fill("800");
  await page.goto("http://localhost:3000/#size=800");
  await page.getByLabel("Size of item (KB): *").press("ControlOrMeta+a");
  await page.getByLabel("Size of item (KB): *").fill("1");
  await page.goto("http://localhost:3000/#size=1");
  await page.getByLabel("Size of item (KB): *").fill("12");
  await page.goto("http://localhost:3000/#size=12");
  await page.getByLabel("Size of item (KB): *").fill("120");
  await page.goto("http://localhost:3000/#size=120");
  await page.getByLabel("Size of item (KB): *").fill("1200");
  await page.goto("http://localhost:3000/#size=1200");
  await page.getByLabel("Size of item (KB): *").press("ArrowLeft");
  await page.getByLabel("Size of item (KB): *").press("ArrowLeft");
  await page.getByLabel("Size of item (KB): *").press("Shift+ArrowLeft");
  await page.getByLabel("Size of item (KB): *").fill("1300");
  await page.goto("http://localhost:3000/#size=1300");
  await page.getByTestId("set-item-button").click();
  // ensures enough time for IDB to take effect
  await page.getByTestId("count-button").click();
  await page.getByTestId("count-button").click();
  await page.getByTestId("count-button").click();
  await expect(page.getByText("54")).toBeVisible();
  await page.getByTestId("set-item-button").click();
  // ensures enough time for IDB to take effect
  await page.getByTestId("count-button").click();
  await page.getByTestId("count-button").click();
  await page.getByTestId("count-button").click();
  await expect(page.getByText("108")).toBeVisible();
  await page.getByTestId("cleanup-button").click();
  // ensures enough time for IDB to take effect
  await page.getByTestId("count-button").click();
  await page.getByTestId("count-button").click();
  await page.getByTestId("count-button").click();
  await expect(page.getByText("100")).toBeVisible();
});
