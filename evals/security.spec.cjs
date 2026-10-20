const artifactDir = require("path").join(__dirname, "artifacts");
require("fs").mkdirSync(artifactDir, { recursive: true });
const { test, expect } = require("@playwright/test");
const postgres = require("postgres");
const fs = require("fs");
test("foreign conversation must not be readable or writable by another tenant", async ({
  page,
}) => {
  const sql = postgres("postgres://fios:fios@127.0.0.1:55432/fios");
  let id = "audit_foreign_" + Date.now();
  try {
    fs.rmSync(artifactDir + "/mock-provider-request.json", { force: true });
    const [project] =
      await sql`select p.id,p.organization_id from projects p join memberships m on m.organization_id=p.organization_id join users u on u.id=m.user_id where u.email <> 'demo@funnelintelligence.dev' limit 1`;
    expect(project).toBeTruthy();
    await sql`insert into ai_conversations (id,organization_id,project_id,title) values (${id},${project.organization_id},${project.id},'Audit foreign private conversation')`;
    await sql`insert into ai_messages (id,conversation_id,role,content) values (${id + "_msg"},${id},'user','AUDIT_FOREIGN_TENANT_PRIVATE_MARKER')`;
    await page.goto("http://localhost:3101/login");
    await page.locator("#email").fill("demo@funnelintelligence.dev");
    await page.locator("#password").fill("demo1234");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.waitForURL(/overview/);
    await page.goto("http://localhost:3101/ai");
    await page
      .locator("textarea[name=question]")
      .fill("Audit question from another tenant");
    await page.locator("textarea[name=question]").evaluate((e, id) => {
      const h = e.form.querySelector("input[name=conversationId]") || document.createElement("input");
      h.type = "hidden";
      h.name = "conversationId";
      h.value = id;
      e.form.append(h);
    }, id);
    await page.getByRole("button", { name: "Ask", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Ask", exact: true }),
    ).toBeEnabled({ timeout: 20000 });
    const messages =
      await sql`select role,content from ai_messages where conversation_id=${id}`;
    const captured = fs.existsSync(artifactDir + "/mock-provider-request.json")
      ? JSON.parse(
          fs.readFileSync(artifactDir + "/mock-provider-request.json", "utf8"),
        )
      : null;
    const evidence = {
      messages,
      foreignHistorySentToProvider: !!captured?.messages?.some((m) =>
        m.content?.includes("AUDIT_FOREIGN_TENANT_PRIVATE_MARKER"),
      ),
      body: await page.locator("main").innerText(),
    };
    fs.writeFileSync(
      artifactDir + "/security-evidence.json",
      JSON.stringify(evidence, null, 2),
    );
    expect(
      messages.length,
      "Other tenant conversation must remain unchanged",
    ).toBe(1);
    expect(evidence.foreignHistorySentToProvider).toBe(false);
    expect(captured, "Rejected conversation must not invoke the provider").toBeNull();
    await expect(page.locator("p[role=alert]")).toContainText(
      "Conversation not found",
    );
  } finally {
    await sql`delete from ai_conversations where id=${id}`;
    await sql.end();
  }
});

test("own-project AI conversation still works after tenant guard", async ({
  page,
}) => {
  await page.goto("http://localhost:3101/login");
  await page.locator("#email").fill("demo@funnelintelligence.dev");
  await page.locator("#password").fill("demo1234");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(/overview/);
  await page.goto("http://localhost:3101/ai");
  await page
    .locator("textarea[name=question]")
    .fill("Show local evaluation answer");
  await page.getByRole("button", { name: "Ask", exact: true }).click();
  await expect(
    page.getByText("Local audit response", { exact: true }).last(),
  ).toBeVisible();
});
