const { test, expect } = require("@playwright/test");
const postgres = require("postgres");
const { createHmac } = require("crypto");

test("configuration, key lifecycle, funnel editing and tenant boundaries", async ({
  page,
  request,
}) => {
  const sql = postgres("postgres://fios:fios@127.0.0.1:55432/fios");
  const email = `config-${Date.now()}@example.test`;
  try {
    await page.goto("/register");
    await page.locator("#email").fill(email);
    await page.locator("#password").fill("demo1234");
    await page
      .getByRole("button", { name: "Fiók létrehozása", exact: true })
      .click();
    await page.waitForURL(/registered/);
    await page.locator("#email").fill(email);
    await page.locator("#password").fill("demo1234");
    await page
      .getByRole("button", { name: "Bejelentkezés", exact: true })
      .click();
    await page.waitForURL(/onboarding/);
    await page.locator("#organizationName").fill("Configuration eval");
    await page.locator("#projectName").fill("Configuration project");
    await page.locator("button[type=submit]").click();
    await page.waitForURL(/integrations/);
    const [project] =
      await sql`select p.id,p.organization_id,m.user_id from projects p join memberships m on m.organization_id=p.organization_id join users u on u.id=m.user_id where u.email=${email}`;
    await page.locator("#keyName").fill("Eval server");
    await page
      .getByRole("button", { name: "Kulcs létrehozása", exact: true })
      .click();
    const keyDisplay = page.getByTestId("new-api-key");
    await expect(keyDisplay).toBeVisible();
    const secret = await keyDisplay.innerText();
    expect(secret).toMatch(/^sk_/);
    expect(
      (
        await request.post("/api/v1/events", {
          headers: { Authorization: `Bearer ${secret}` },
          data: { event_name: "lead_created", anonymous_id: "config-eval" },
        })
      ).status(),
    ).toBe(202);
    await page.reload();
    await expect(page.getByTestId("new-api-key")).toHaveCount(0);
    await expect(page.getByText(secret, { exact: true })).toHaveCount(0);
    page.on("dialog", (d) => d.accept());
    await page
      .locator("tr")
      .filter({ hasText: "Eval server" })
      .getByRole("button", { name: "Visszavonás", exact: true })
      .click();
    await expect(
      page.locator("tr").filter({ hasText: "Eval server" }),
    ).toContainText("Visszavonva");
    expect(
      (
        await request.post("/api/v1/events", {
          headers: { Authorization: `Bearer ${secret}` },
          data: { event_name: "page_view" },
        })
      ).status(),
    ).toBe(401);
    const signingSecret = "audit-local-webhook-secret";
    await page.locator("#webhookSecret").fill(signingSecret);
    await page.locator("#mapping").fill(
      JSON.stringify({
        event_name: "=call_booked",
        event_id: "id",
        email: "email",
      }),
    );
    await page
      .getByRole("button", { name: "Webhook mentése", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Webhook leválasztása", exact: true }),
    ).toBeVisible();
    const body = JSON.stringify({
      id: "ui_webhook_" + Date.now(),
      email: "webhook-ui@example.test",
    });
    const opt = {
      headers: {
        "x-signature": createHmac("sha256", signingSecret)
          .update(body)
          .digest("hex"),
      },
      data: Buffer.from(body),
    };
    expect(
      (
        await request.post("/api/webhooks/webhook?project=" + project.id, opt)
      ).status(),
    ).toBe(200);
    expect(
      (
        await request.post("/api/webhooks/webhook?project=" + project.id, {
          data: Buffer.from(body),
        })
      ).status(),
    ).toBe(401);
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Webhook leválasztása", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Webhook leválasztása", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Webhook leválasztása", exact: true }),
    ).toHaveCount(0);
    expect(
      (
        await request.post("/api/webhooks/webhook?project=" + project.id, opt)
      ).status(),
    ).toBe(404);
    await page.goto("/settings");
    await page.locator("#projectName").fill("Renamed eval project");
    await page.locator("#timezone").fill("Europe/Budapest");
    await page
      .getByRole("button", { name: "Munkaterület mentése", exact: true })
      .click();
    await expect(page.getByRole("status").first()).toHaveText("Mentve.");
    await page.reload();
    await expect(page.locator("#projectName")).toHaveValue(
      "Renamed eval project",
    );
    await expect(page.locator("#timezone")).toHaveValue("Europe/Budapest");
    await page.locator("#model").selectOption("LAST_TOUCH");
    await page.locator("#windowDays").fill("7");
    await page.locator("input[name=includeDirect]").uncheck();
    await page
      .getByRole("button", { name: "Attribúció mentése", exact: true })
      .click();
    await expect(page.getByRole("status").last()).toHaveText("Mentve.");
    await page.goto("/attribution");
    await expect(page.getByText(/Beállított modell:/)).toContainText(
      "Időablak: 7 nap",
    );
    await expect(page.getByText(/Beállított modell:/)).toContainText(
      "Közvetlen forgalom: kizárva",
    );
    await page.goto("/funnels");
    await page.getByText("Tölcsér szerkesztése", { exact: true }).click();
    const editor = page
      .locator("details")
      .filter({ has: page.getByText("Tölcsér szerkesztése", { exact: true }) });
    await editor
      .getByLabel("Tölcsér neve", { exact: true })
      .fill("Eval edited funnel");
    await editor.locator("#step-name-0").fill("Eval landing");
    await editor.locator("#step-target-0").fill("25");
    await editor
      .getByRole("button", { name: "Lépés hozzáadása", exact: true })
      .click();
    await editor
      .locator("[data-testid=editable-step]")
      .last()
      .getByLabel("Név", { exact: true })
      .fill("Eval final step");
    await editor
      .getByRole("button", { name: "Tölcsér mentése", exact: true })
      .click();
    await page.waitForURL(/funnels\?id=/);
    await expect(page.locator("h1")).toHaveText("Eval edited funnel");
    await page.reload();
    await page.getByText("Tölcsér szerkesztése", { exact: true }).click();
    await expect(page.locator("#step-name-0").first()).toHaveValue(
      "Eval landing",
    );
    await expect(page.locator("#step-target-0").first()).toHaveValue("25");
    const [node] =
      await sql`select target_conversion_rate from funnel_nodes where project_id=${project.id} and name='Eval landing'`;
    expect(node.target_conversion_rate).toBe(0.25);
    // An already-rendered admin form must not bypass a subsequent role downgrade.
    await page.goto("/integrations");
    await page.locator("#keyName").fill("Must not create");
    await sql`update memberships set role='VIEWER' where user_id=${project.user_id} and organization_id=${project.organization_id}`;
    await page
      .getByRole("button", { name: "Kulcs létrehozása", exact: true })
      .click();
    await expect(page.locator("p[role=alert]")).toContainText(
      "Rendszergazdai jogosultság szükséges",
    );
    expect(
      Number(
        (
          await sql`select count(*) from api_keys where project_id=${project.id} and name='Must not create'`
        )[0].count,
      ),
    ).toBe(0);
    await sql`update memberships set role='OWNER' where user_id=${project.user_id} and organization_id=${project.organization_id}`;
    await page.reload();
    await page.locator("#keyName").fill("Wrong tenant");
    const [foreign] =
      await sql`select id from projects where id<>${project.id} limit 1`;
    await page
      .locator("#keyName")
      .evaluate(
        (input, id) =>
          (input.form.querySelector("input[name=projectId]").value = id),
        foreign.id,
      );
    await page
      .getByRole("button", { name: "Kulcs létrehozása", exact: true })
      .click();
    await page.waitForTimeout(300);
    expect(
      Number(
        (await sql`select count(*) from api_keys where name='Wrong tenant'`)[0]
          .count,
      ),
    ).toBe(0);
  } finally {
    await sql.end();
  }
});
