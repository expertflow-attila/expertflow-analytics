const { test, expect } = require("@playwright/test");
const path = require("path");

test("Hungarian authentication pages share the Business Native design", async ({ page }) => {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  for (const [route, heading] of [
    ["/login", "Üdv újra!"],
    ["/register", "Hozd létre a fiókodat"],
    ["/forgot-password", "Jelszó visszaállítása"],
    ["/reset-password", "Érvénytelen hivatkozás"],
    ["/verify-email", "E-mail-cím megerősítése"],
    ["/missing-localization-eval-page", "Ez az oldal nem található"],
  ]) {
    await page.goto(route);
    await expect(page.locator("html")).toHaveAttribute("lang", "hu");
    await expect(page.locator("h1")).toHaveText(heading);
    await expect(page.getByRole("link", {name:"Business Native – Analitikai rutin"})).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const style = await page.locator(".auth-panel").evaluate(el => ({
      font: getComputedStyle(el).fontFamily,
      radius: getComputedStyle(el).borderRadius,
    }));
    expect(style.font).toMatch(/Geist/);
    expect(style.radius).toBe("12px");
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({width, height:900});
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    }
    await page.screenshot({path:path.join(__dirname,"artifacts",`${route.slice(1)}-hu.png`),fullPage:true});
  }
  expect(errors).toEqual([]);
});

test("Hungarian mobile navigation and sign out work end to end", async ({ page }) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto("/login");
  await page.locator("#email").fill("demo@funnelintelligence.dev");
  await page.locator("#password").fill("demo1234");
  await page.getByRole("button",{name:"Bejelentkezés",exact:true}).click();
  await page.waitForURL(/overview/);
  await page.getByRole("button",{name:"Menü megnyitása"}).click();
  const menu = page.getByRole("navigation",{name:"Mobil navigáció"});
  await expect(menu.getByRole("link")).toHaveCount(12);
  await menu.getByRole("link",{name:"Beállítások",exact:true}).click();
  await expect(page.locator("main h1")).toHaveText("Beállítások");
  await expect(page.getByRole("button",{name:"Menü megnyitása"})).toHaveAttribute("aria-expanded","false");
  await page.getByRole("button",{name:"Menü megnyitása"}).click();
  await menu.getByRole("link",{name:"Kijelentkezés",exact:true}).click();
  await expect(page.locator("h1")).toHaveText("Kijelentkezés");
  await page.getByRole("button",{name:"Kijelentkezés",exact:true}).click();
  await page.waitForURL(/login/);
  await page.goto("/overview");
  await expect(page).toHaveURL(/login/);
});
