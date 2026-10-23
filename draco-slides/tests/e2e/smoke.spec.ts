import { expect, test } from "@playwright/test";

// Run once with: npx playwright install chromium   then: npm run e2e

test("a new presentation survives a reload", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New presentation" }).click();
  await page.getByRole("button", { name: "New slide" }).click();
  await expect(page.getByText("Slide 2 of 2")).toBeVisible();
  await expect(page.getByText("Saved in this browser")).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "Your presentations" })).toBeVisible();
  await expect(page.getByText("2 slides").first()).toBeVisible();
  await page.getByText("2 slides").first().click();
  await expect(page.getByText("Slide 1 of 2")).toBeVisible();
});

test("the light theme can be chosen and is remembered", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByLabel("Theme").selectOption("light");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("zoom and fit work in the editor", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New presentation" }).click();
  await page.getByRole("tab", { name: "View" }).click();
  await page.getByRole("button", { name: "Actual size" }).click();
  await expect(page.getByText("Zoom 100%")).toBeVisible();
  await page.getByRole("button", { name: "Fit to window" }).click();
  await expect(page.getByText(/Zoom \d+%/)).not.toHaveText("Zoom 100%");
});

test("the keyboard can reach and operate the File menu", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New presentation" }).click();
  await page.getByRole("button", { name: "File" }).focus();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("menuitem", { name: "Properties" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "File" })).toBeFocused();
});
