const { test, expect } = require("@playwright/test");

test("password recovery reports missing email delivery without claiming success", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("link", { name: "Forgot password?" }).click();
  await expect(page.locator("h1")).toHaveText("Reset your password");
  await page.locator("#email").fill("demo@funnelintelligence.dev");
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.locator('p[role="alert"]')).toContainText("not configured");
  await page.goto("/forgot-password?sent=1");
  await expect(page.getByText("If an account exists for that email, a reset link has been sent.")).toHaveCount(0);
  await page.setViewportSize({ width: 320, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("password recovery rejects missing and invalid tokens", async ({ page }) => {
  await page.goto("/reset-password");
  await expect(page.locator("h1")).toHaveText("Invalid link");
  await page.goto("/reset-password?token=invalid-eval-token");
  await expect(page.locator("h1")).toHaveText("Set a new password");
  await page.locator("#password").fill("unused-eval-password-123");
  await page.getByRole("button", { name: "Update password" }).click();
  await expect(page.locator('p[role="alert"]')).toContainText("invalid or has expired");
});
