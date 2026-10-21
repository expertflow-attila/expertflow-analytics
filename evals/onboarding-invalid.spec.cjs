const { confirmRegistration } = require("./helpers/confirm-registration.cjs");
const artifactDir = require("path").join(__dirname, "artifacts");
require("fs").mkdirSync(artifactDir, { recursive: true });
const { test, expect } = require("@playwright/test");
const fs = require("fs");
test("invalid timezone must be rejected before workspace creation", async ({
  page,
}) => {
  const email = `invalid-timezone-${Date.now()}@example.test`;
  await page.goto("/register");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill("demo1234");
  await page
    .getByRole("button", { name: "Fiók létrehozása", exact: true })
    .click();
  await confirmRegistration(page, email);
  await page.locator("#email").fill(email);
  await page.locator("#password").fill("demo1234");
  await page
    .getByRole("button", { name: "Bejelentkezés", exact: true })
    .click();
  await page.waitForURL(/onboarding/);
  await page.locator("#organizationName").fill("Invalid timezone audit");
  await page.locator("#projectName").fill("Invalid timezone project");
  await page.locator("#timezone").fill("not-a-timezone");
  await page.locator("button[type=submit]").click();
  await expect(page.locator("p[role=alert]")).toContainText(
    "érvényes IANA-időzónát",
  );
  const accepted = page.url().includes("integrations");
  let status = null;
  if (accepted) {
    const key = (await page.locator("body").innerText()).match(
      /pk_[A-Za-z0-9_-]+/,
    )[0];
    await page.request.post("/api/v1/events", {
      headers: { "X-Project-Key": key },
      data: {
        event_name: "page_view",
        anonymous_id: "invalid-timezone-person",
      },
    });
    status = (await page.goto("/overview")).status();
    await page.screenshot({ path: artifactDir + "/invalid-timezone.png" });
  }
  fs.writeFileSync(
    artifactDir + "/timezone-evidence.json",
    JSON.stringify({ accepted, overviewStatus: status }),
  );
  expect(accepted, "Invalid timezone must not be saved").toBe(false);
});
