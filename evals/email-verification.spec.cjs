const { test, expect } = require("@playwright/test");
const postgres = require("postgres");
const { createHash } = require("node:crypto");

async function register(page, email) {
  await page.goto("/register");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill("verification-local-123");
  await page
    .getByRole("button", { name: "Fiók létrehozása", exact: true })
    .click();
}
async function messages(page, email) {
  return (
    await (await page.request.get("http://127.0.0.1:3199/messages")).json()
  ).filter(
    (m) =>
      m.to.includes(email) && m.subject.includes("E-mail-cím megerősítése"),
  );
}
function link(message) {
  return message.text.match(
    /http:\/\/localhost:\d+\/verify-email\?token=[a-f0-9]{64}/,
  )[0];
}
async function login(page, email) {
  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill("verification-local-123");
  await page
    .getByRole("button", { name: "Bejelentkezés", exact: true })
    .click();
}

test("email confirmation is mandatory and existing unverified sessions cannot bypass it", async ({
  page,
}) => {
  const sql = postgres("postgres://fios:fios@127.0.0.1:55432/fios");
  const email = `verification-${Date.now()}@example.test`;
  try {
    await register(page, email);
    await expect(page).toHaveURL(/verify-email\?notice=sent/);
    const mailbox = await messages(page, email);
    expect(mailbox).toHaveLength(1);
    await login(page, email);
    await expect(page).toHaveURL(/verify-email\?notice=required/);
    await page.goto("/overview");
    await expect(page).toHaveURL(/login/);
    const verifyLink = link(mailbox[0]);
    await page.goto(verifyLink);
    expect(
      (await sql`select email_verified_at from users where email=${email}`)[0]
        .email_verified_at,
    ).toBeNull();
    const token = new URL(verifyLink).searchParams.get("token");
    const [stored] =
      await sql`select token from verification_tokens where identifier=${email}`;
    expect(stored.token).toBe(
      "email-verification:" + createHash("sha256").update(token).digest("hex"),
    );
    await page
      .getByRole("button", { name: "E-mail-cím megerősítése", exact: true })
      .click();
    await page.waitForURL(/login\?verified=1/);
    await login(page, email);
    await page.waitForURL(/onboarding/);
    await page.goto(verifyLink);
    await page
      .getByRole("button", { name: "E-mail-cím megerősítése", exact: true })
      .click();
    await expect(page.locator('p[role="alert"]')).toContainText(
      "már felhasználtad",
    );
    await sql`update users set email_verified_at=null where email=${email}`;
    await page.goto("/onboarding");
    await expect(page).toHaveURL(/login/);
  } finally {
    await sql.end();
  }
});

test("expired verification links can be replaced without exposing account existence", async ({
  page,
}) => {
  const sql = postgres("postgres://fios:fios@127.0.0.1:55432/fios");
  const email = `expired-verification-${Date.now()}@example.test`;
  try {
    await register(page, email);
    await expect(page).toHaveURL(/verify-email\?notice=sent/);
    const original = link((await messages(page, email))[0]);
    await sql`update verification_tokens set expires=now()-interval '1 minute' where identifier=${email}`;
    await page.goto(original);
    await page
      .getByRole("button", { name: "E-mail-cím megerősítése", exact: true })
      .click();
    await expect(page.locator('p[role="alert"]')).toContainText("lejárt");
    await page.locator("#email").fill(email);
    await page
      .getByRole("button", { name: "Megerősítő levél kérése", exact: true })
      .click();
    await expect(page.locator('p[role="status"]')).toContainText("elküldtük");
    const mailbox = await messages(page, email);
    expect(mailbox).toHaveLength(2);
    await page.goto(link(mailbox[1]));
    await page
      .getByRole("button", { name: "E-mail-cím megerősítése", exact: true })
      .click();
    await page.waitForURL(/login\?verified=1/);
    for (const address of [email, `absent-${Date.now()}@example.test`]) {
      await page.goto("/verify-email");
      await page.locator("#email").fill(address);
      await page
        .getByRole("button", { name: "Megerősítő levél kérése", exact: true })
        .click();
      await expect(page.locator('p[role="status"]')).toContainText(
        "Ha ehhez a címhez",
      );
    }
    expect(await messages(page, email)).toHaveLength(2);
  } finally {
    await sql.end();
  }
});

test("failed registration email leaves a recoverable pending account", async ({
  page,
}) => {
  const email = `delivery-retry-${Date.now()}@example.test`;
  await page.request.post("http://127.0.0.1:3199/fail-next");
  await register(page, email);
  await expect(page).toHaveURL(/verify-email\?notice=delivery-failed/);
  await expect(page.locator('p[role="alert"]')).toContainText(
    "nem sikerült elküldeni",
  );
  await page.locator("#email").fill(email);
  await page
    .getByRole("button", { name: "Megerősítő levél kérése", exact: true })
    .click();
  await expect(page.locator('p[role="status"]')).toContainText("elküldtük");
  await page.goto(link((await messages(page, email))[0]));
  await page
    .getByRole("button", { name: "E-mail-cím megerősítése", exact: true })
    .click();
  await page.waitForURL(/login\?verified=1/);
  await login(page, email);
  await page.waitForURL(/onboarding/);
});
