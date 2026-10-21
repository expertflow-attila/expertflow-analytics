const { expect } = require("@playwright/test");
async function confirmRegistration(page, email) {
  await expect(page).toHaveURL(/verify-email\?notice=sent/);
  const response = await page.request.get("http://127.0.0.1:3199/messages");
  const messages = (await response.json()).filter(
    (m) =>
      m.to.includes(email) && m.subject.includes("E-mail-cím megerősítése"),
  );
  expect(messages).toHaveLength(1);
  const link = messages[0].text.match(
    /http:\/\/localhost:\d+\/verify-email\?token=[a-f0-9]{64}/,
  )?.[0];
  expect(link).toBeTruthy();
  await page.goto(link);
  await page
    .getByRole("button", { name: "E-mail-cím megerősítése", exact: true })
    .click();
  await page.waitForURL(/login\?verified=1/);
}
module.exports = { confirmRegistration };
