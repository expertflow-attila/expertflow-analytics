const { test, expect } = require("@playwright/test");

test("password recovery reports missing email delivery without claiming success", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByRole("link", { name: "Elfelejtetted a jelszavad?" }).click();
  await expect(page.locator("h1")).toHaveText("Jelszó visszaállítása");
  await page.locator("#email").fill("demo@funnelintelligence.dev");
  await page
    .getByRole("button", { name: "Visszaállítási link kérése" })
    .click();
  await expect(page.locator('p[role="alert"]')).toContainText(
    "nincs beállítva",
  );
  await page.goto("/forgot-password?sent=1");
  await expect(
    page.getByText(
      "If an account exists for that email, a reset link has been sent.",
    ),
  ).toHaveCount(0);
  await page.setViewportSize({ width: 320, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("password recovery rejects missing and invalid tokens", async ({
  page,
}) => {
  await page.goto("/reset-password");
  await expect(page.locator("h1")).toHaveText("Érvénytelen hivatkozás");
  await page.goto("/reset-password?token=invalid-eval-token");
  await expect(page.locator("h1")).toHaveText("Új jelszó beállítása");
  await page.locator("#password").fill("unused-eval-password-123");
  await page.getByRole("button", { name: "Jelszó mentése" }).click();
  await expect(page.locator('p[role="alert"]')).toContainText(
    "érvénytelen vagy lejárt",
  );
});
