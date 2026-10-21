const { confirmRegistration } = require("./helpers/confirm-registration.cjs");
const { test, expect } = require("@playwright/test");

// Run against a locally configured mail transport: real delivery must never
// be replaced by an insecure public endpoint or browser-exposed recovery token.
test("recovery email lets a user choose a password and log back in", async ({
  page,
  request,
}) => {
  const email = `recovery-${Date.now()}@example.test`;
  const oldPassword = "old-local-password-123";
  const newPassword = "new-local-password-456";
  await page.goto("http://localhost:3102/register");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(oldPassword);
  await page
    .getByRole("button", { name: "Fiók létrehozása", exact: true })
    .click();
  await confirmRegistration(page, email);
  await page.getByRole("link", { name: "Elfelejtetted a jelszavad?" }).click();
  await page.locator("#email").fill(email.toUpperCase());
  await page
    .getByRole("button", { name: "Visszaállítási link kérése" })
    .click();
  await expect(page.getByRole("status")).toContainText("elküldtük");
  const response = await request.get("http://127.0.0.1:3199/messages");
  const messages = (await response.json()).filter(
    (m) => m.to.includes(email) && m.subject.includes("Jelszó visszaállítása"),
  );
  expect(messages).toHaveLength(1);
  const link = messages[0].text.match(
    /http:\/\/localhost:3102\/reset-password\?token=[a-f0-9]{64}/,
  )?.[0];
  expect(link).toBeTruthy();
  // The browser response exposes a generic confirmation, never a reset link.
  expect(await page.locator("body").innerText()).not.toContain("?token=");
  await page.goto(link);
  await page.locator("#password").fill(newPassword);
  await page.getByRole("button", { name: "Jelszó mentése" }).click();
  await page.waitForURL(/login\?reset=1/);
  await expect(
    page.getByText("A jelszavad megváltozott. Most már bejelentkezhetsz."),
  ).toBeVisible();
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(oldPassword);
  await page
    .getByRole("button", { name: "Bejelentkezés", exact: true })
    .click();
  await expect(page.locator('p[role="alert"]')).toContainText("nem megfelelő");
  await page.locator("#email").fill(email.toUpperCase());
  await page.locator("#password").fill(newPassword);
  await page
    .getByRole("button", { name: "Bejelentkezés", exact: true })
    .click();
  await page.waitForURL(/onboarding/);
  await page.goto(link);
  await page.locator("#password").fill("must-not-change-again-123");
  await page.getByRole("button", { name: "Jelszó mentése" }).click();
  await expect(page.locator('p[role="alert"]')).toContainText(
    "érvénytelen vagy lejárt",
  );
});
