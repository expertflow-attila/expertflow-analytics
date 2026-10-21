const { confirmRegistration } = require("./helpers/confirm-registration.cjs");
const artifactDir = require("path").join(__dirname, "artifacts");
require("fs").mkdirSync(artifactDir, { recursive: true });
const { test, expect } = require("@playwright/test");
const fs = require("fs");
const routes = [
  "overview",
  "funnels",
  "journeys",
  "opportunities",
  "attribution",
  "cohorts",
  "revenue",
  "tracking-health",
  "ai",
  "integrations",
  "settings",
];
async function login(page, email = "demo@funnelintelligence.dev") {
  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill("demo1234");
  await page
    .getByRole("button", { name: "Bejelentkezés", exact: true })
    .click();
  await page.waitForURL(/overview|onboarding/);
}
test("unauthenticated routes and invalid login", async ({ page }) => {
  for (const r of routes) {
    await page.goto("/" + r);
    await expect(page).toHaveURL(/login/);
  }
  await page.locator("#email").fill("absent@example.test");
  await page.locator("#password").fill("wrongpassword");
  await page
    .getByRole("button", { name: "Bejelentkezés", exact: true })
    .click();
  await expect(page.locator("p[role=alert]")).toBeVisible();
});
test("all analytics routes desktop and mobile", async ({ page }) => {
  const evidence = [];
  const errors = [];
  page.on("pageerror", (e) =>
    errors.push({ url: page.url(), message: e.message }),
  );
  await login(page);
  for (const route of routes) {
    const response = await page.goto("/" + route);
    await page.locator("main h1").waitFor();
    await page.evaluate(() => document.fonts.ready);
    const item = {
      route,
      status: response.status(),
      title: await page.locator("main h1").innerText(),
      buttons: await page.locator("main button").allTextContents(),
      inputs: await page.locator("main input,main select").count(),
    };
    await page.screenshot({
      path: `${artifactDir}/${route}-desktop.png`,
      fullPage: true,
    });
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      item["width" + width] = await page.evaluate(() => ({
        viewport: innerWidth,
        content: document.documentElement.scrollWidth,
        nav: [...document.querySelectorAll("nav a")]
          .filter((e) => e.getBoundingClientRect().width > 0)
          .map((e) => e.textContent),
      }));
      expect(
        item["width" + width].content,
        `${route} at ${width}px`,
      ).toBeLessThanOrEqual(width);
    }
    await page.screenshot({
      path: `${artifactDir}/${route}-mobile.png`,
      fullPage: true,
    });
    evidence.push(item);
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
  fs.writeFileSync(
    artifactDir + "/routes.json",
    JSON.stringify({ evidence, errors }, null, 2),
  );
  expect(errors).toEqual([]);
});
test("journey filters, customer details and funnel interaction", async ({
  page,
}) => {
  await login(page);
  await page.goto("/journeys");
  await page.getByRole("link", { name: "Csak vásárlók", exact: true }).click();
  await expect(page).toHaveURL(/filter=customers/);
  const customer = page.locator('a[href^="/customers/"]').first();
  await expect(customer).toBeVisible();
  await customer.click();
  await expect(page.locator("main h1")).toBeVisible();
  await page.screenshot({
    path: artifactDir + "/customer-desktop.png",
    fullPage: true,
  });
  await page.goto("/funnels");
  await page
    .getByRole("button", { name: "Nézet igazítása", exact: true })
    .click();
  await page.locator(".react-flow__node button").first().click();
  await expect(
    page.locator(".react-flow__node button").first(),
  ).toHaveAttribute("aria-pressed", "true");
  await page.screenshot({
    path: artifactDir + "/funnel-selected.png",
    fullPage: true,
  });
  await page.goto("/funnels?id=missing");
  await expect(page.getByText("Ez a tölcsér nem található")).toBeVisible();
});
test("new account and empty workspace onboarding", async ({ page }) => {
  const email = `audit-${Date.now()}@example.test`;
  await page.goto("/register");
  await page.locator("#name").fill("Audit user");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill("demo1234");
  await page
    .getByRole("button", { name: "Fiók létrehozása", exact: true })
    .click();
  await confirmRegistration(page, email);
  await login(page, email);
  await expect(page).toHaveURL(/onboarding/);
  await page.locator("#organizationName").fill("Audit workspace");
  await page.locator("#projectName").fill("Audit project");
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/integrations/);
  await page.screenshot({
    path: artifactDir + "/new-workspace.png",
    fullPage: true,
  });
  for (const r of routes) {
    await page.goto("/" + r);
    await expect(page.locator("main h1")).toBeVisible();
    await expect(page.getByText("Application error:")).toHaveCount(0);
  }
});
