const artifactDir = require("path").join(__dirname, "artifacts");
require("fs").mkdirSync(artifactDir, { recursive: true });
const { test, expect } = require("@playwright/test");
async function login(page) {
  await page.goto("/login");
  await page.locator("#email").fill("demo@funnelintelligence.dev");
  await page.locator("#password").fill("demo1234");
  await page
    .getByRole("button", { name: "Bejelentkezés", exact: true })
    .click();
  await page.waitForURL(/overview/);
}
test("mobile journey must fit viewport", async ({ page }) => {
  await login(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/journeys");
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
});
test("mobile must allow settings navigation and logout", async ({ page }) => {
  await login(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Menü megnyitása" }).click();
  await expect(
    page.getByRole("link", { name: "Beállítások", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Kijelentkezés", exact: true }),
  ).toBeVisible();
});
test("unsupported range must safely default", async ({ page }) => {
  await login(page);
  const response = await page.goto("/overview?range=toString");
  await page.screenshot({
    path: artifactDir + "/invalid-range.png",
    fullPage: true,
  });
  expect(response.status()).toBeLessThan(400);
  await expect(page.locator("main h1")).toBeVisible();
});
test("funnel node selection works after zoom to fit", async ({ page }) => {
  await login(page);
  await page.goto("/funnels");
  const control = page.getByRole("button", { name: "Nagyítás", exact: true });
  const colors = await control.evaluate((el) => ({
    background: getComputedStyle(el).backgroundColor,
    foreground: getComputedStyle(el).color,
  }));
  expect(colors.background).toBe("rgb(18, 18, 18)");
  expect(colors.foreground).not.toBe(colors.background);
  await page
    .getByRole("button", { name: "Nézet igazítása", exact: true })
    .click();
  await page
    .locator(".react-flow__node button")
    .first()
    .click({ timeout: 10000 });
  await expect(
    page.locator(".react-flow__node button").first(),
  ).toHaveAttribute("aria-pressed", "true");
});
