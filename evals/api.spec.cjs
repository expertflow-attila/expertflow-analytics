const artifactDir = require("path").join(__dirname, "artifacts");
require("fs").mkdirSync(artifactDir, { recursive: true });
const { test, expect } = require("@playwright/test");
const postgres = require("postgres");
const db = () => postgres("postgres://fios:fios@127.0.0.1:55432/fios");
async function key(sql) {
  const [r] =
    await sql`select k.key_plain,k.project_id from api_keys k join projects p on p.id=k.project_id where k.type='PUBLISHABLE' and p.name='Audit project' limit 1`;
  if (r) return r;
  const random = require("crypto").randomBytes(12).toString("hex");
  const org = "org_eval_" + random;
  const project = "prj_eval_" + random;
  const raw = "pk_" + require("crypto").randomBytes(24).toString("base64url");
  await sql.begin(async (tx) => {
    await tx`insert into organizations(id,name,slug,timezone) values(${org},'API eval',${org},'UTC')`;
    await tx`insert into projects(id,organization_id,name,slug,base_currency) values(${project},${org},'Audit project',${project},'EUR')`;
    await tx`insert into api_keys(id,organization_id,project_id,type,name,key_plain,key_last4) values(${"key_" + random},${org},${project},'PUBLISHABLE','Eval browser',${raw},${raw.slice(-4)})`;
  });
  return { key_plain: raw, project_id: project };
}
test("HTTP event validation authentication batch and idempotency", async ({
  request,
}) => {
  const sql = db();
  try {
    const k = await key(sql);
    expect(
      (
        await request.post("/api/v1/events", {
          data: { event_name: "page_view" },
        })
      ).status(),
    ).toBe(401);
    expect(
      (await request.fetch("/api/v1/events", { method: "OPTIONS" })).status(),
    ).toBe(204);
    const headers = { "X-Project-Key": k.key_plain };
    expect(
      (
        await request.post("/api/v1/events", {
          headers,
          data: { event_name: "INVALID EVENT" },
        })
      ).status(),
    ).toBe(422);
    expect(
      (
        await request.post("/api/v1/events", {
          headers: { ...headers, "content-type": "application/json" },
          data: Buffer.from("{"),
        })
      ).status(),
    ).toBe(400);
    const event = {
      event_id: "audit_event_" + Date.now(),
      event_name: "lead_created",
      anonymous_id: "audit_api_person",
      identify: { email: "api-audit@example.test" },
    };
    const one = await request.post("/api/v1/events", { headers, data: event });
    expect(one.status()).toBe(202);
    expect((await one.json()).accepted).toBe(1);
    const two = await request.post("/api/v1/events/batch", {
      headers,
      data: { events: [event, event] },
    });
    expect(two.status()).toBe(202);
    expect((await two.json()).duplicates).toBe(2);
    const rows =
      await sql`select event_id from events where project_id=${k.project_id} and event_id=${event.event_id}`;
    expect(rows.length).toBe(1);
    expect(
      (await request.post("/api/webhooks/unknown", { data: {} })).status(),
    ).toBe(404);
    expect(
      (await request.post("/api/webhooks/stripe", { data: {} })).status(),
    ).toBe(400);
    expect(
      (
        await request.post("/api/webhooks/stripe?project=" + k.project_id, {
          data: {},
        })
      ).status(),
    ).toBe(404);
  } finally {
    await sql.end();
  }
});
test("browser SDK consent, identify, UTM and reset", async ({ page }) => {
  const sql = db();
  try {
    const k = await key(sql);
    await sql`delete from events where project_id=${k.project_id} and event_name='audit_sdk_event'`;
    await page.route("**/audit-sdk*", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: `<title>SDK audit</title><script src="/sdk.js" data-project-key="${k.key_plain}" data-require-consent="true" data-auto-page="false"></script>`,
      }),
    );
    await page.goto("/audit-sdk?utm_source=audit&utm_medium=email");
    await page.waitForFunction(() => window.funnel?.__loaded);
    await page.evaluate(() => {
      window.funnel.track("audit_without_consent");
      window.funnel.flush();
    });
    expect(
      await page.evaluate(
        () => JSON.parse(localStorage.getItem("fios_queue") || "[]").length,
      ),
    ).toBe(0);
    await page.evaluate(() => {
      window.funnel.consent.grant();
      window.funnel.identify({ email: "sdk-audit@example.test" });
      window.funnel.track("audit_sdk_event");
      window.funnel.flush();
    });
    await expect
      .poll(
        async () =>
          Number(
            (
              await sql`select count(*) from events where project_id=${k.project_id} and event_name='audit_sdk_event'`
            )[0].count,
          ),
        { timeout: 15000 },
      )
      .toBe(1);
    const [event] =
      await sql`select person_id,utm_source from events where project_id=${k.project_id} and event_name='audit_sdk_event'`;
    expect(event.person_id).toBeTruthy();
    expect(event.utm_source).toBe("audit");
    const before = await page.evaluate(() => localStorage.getItem("fios_anon"));
    await page.evaluate(() => window.funnel.reset());
    expect(
      await page.evaluate(() => localStorage.getItem("fios_anon")),
    ).not.toBe(before);
  } finally {
    await sql.end();
  }
});
test("SDK retains queue on temporary HTTP 500", async ({ page }) => {
  const sql = db();
  try {
    const k = await key(sql);
    await page.route("**/api/v1/events", (r) =>
      r.fulfill({ status: 500, body: "temporary outage" }),
    );
    await page.route("**/audit-failure", (r) =>
      r.fulfill({
        contentType: "text/html",
        body: `<script src="/sdk.js" data-project-key="${k.key_plain}" data-auto-page="false"></script>`,
      }),
    );
    await page.goto("/audit-failure");
    await page.waitForFunction(() => window.funnel?.__loaded);
    const failedResponse = page.waitForResponse(
      (r) => r.url().includes("/api/v1/events") && r.status() === 500,
    );
    await page.evaluate(() => {
      window.funnel.track("audit_retry");
      window.funnel.flush();
    });
    await failedResponse;
    await page.waitForTimeout(100);
    expect(
      await page.evaluate(
        () => JSON.parse(localStorage.getItem("fios_queue") || "[]").length,
      ),
      "Temporary failure must preserve events for retry",
    ).toBeGreaterThan(0);
  } finally {
    await sql.end();
  }
});
test("signed generic webhook rejects tampering and deduplicates delivery", async ({
  request,
}) => {
  const sql = db();
  const crypto = require("crypto");
  const fs = require("fs");
  const dotenv = require("dotenv");
  let id = "audit_webhook_" + Date.now();
  try {
    const k = await key(sql);
    const [p] =
      await sql`select organization_id from projects where id=${k.project_id}`;
    const secret = "audit-only-signature-secret";
    const conf = JSON.stringify({
      secret,
      mapping: { event_name: "=call_booked", event_id: "id", email: "email" },
    });
    const env = dotenv.parse(
      fs.readFileSync(require("path").join(__dirname, "../.env")),
    );
    const iv = crypto.randomBytes(12);
    const c = crypto.createCipheriv(
      "aes-256-gcm",
      Buffer.from(env.ENCRYPTION_KEY, "base64"),
      iv,
    );
    const data = Buffer.concat([c.update(conf), c.final()]);
    const encrypted = [iv, c.getAuthTag(), data]
      .map((b) => b.toString("base64"))
      .join(".");
    await sql`insert into integrations(id,organization_id,project_id,provider,display_name,encrypted_config) values(${id},${p.organization_id},${k.project_id},'webhook','Audit local webhook',${encrypted})`;
    const body = JSON.stringify({
      id: "evt_webhook_" + Date.now(),
      email: "webhook-audit@example.test",
    });
    const url = "/api/webhooks/webhook?project=" + k.project_id;
    expect(
      (await request.post(url, { data: Buffer.from(body) })).status(),
    ).toBe(401);
    const sig = crypto.createHmac("sha256", secret).update(body).digest("hex");
    const opt = {
      headers: { "content-type": "application/json", "x-signature": sig },
      data: Buffer.from(body),
    };
    expect((await request.post(url, opt)).status()).toBe(200);
    expect((await request.post(url, opt)).status()).toBe(200);
    expect(
      Number(
        (
          await sql`select count(*) from events where event_id=${JSON.parse(body).id} and project_id=${k.project_id}`
        )[0].count,
      ),
    ).toBe(1);
  } finally {
    await sql`delete from integrations where id=${id}`;
    await sql.end();
  }
});
