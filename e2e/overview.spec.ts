import { test, expect } from "@playwright/test";

test("overview page loads with decision summary", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Know what to fix next/i })).toBeVisible();
  await expect(page.getByText(/Executive summary/i)).toBeVisible();
  await expect(page.getByText(/Seed dataset/i)).toBeVisible();
});
