import { formatDate } from "@/lib/utils";
import { displayLabel } from "@/lib/labels";
import { eq } from "drizzle-orm";

import { PageBody, PageHeader } from "@/components/page";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, Table, Td, Th } from "@/components/ui/primitives";
import { ConfigForm } from "@/components/config-form";
import {
  createKey,
  revokeKey,
  saveIntegration,
} from "@/server/actions/configuration";
import { Input, Label } from "@/components/ui/primitives";
import { env } from "@/env";
import { resolveProjectContext } from "@/server/analytics/context";
import { db } from "@/server/db";
import { apiKeys, integrations } from "@/server/db/schema";

export const metadata = { title: "Integrációk" };
export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  const ctx = await resolveProjectContext();

  const keys = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.projectId, ctx.projectId));

  const connected = await db
    .select()
    .from(integrations)
    .where(eq(integrations.projectId, ctx.projectId));

  const publishable = keys.find(
    (k) => k.type === "PUBLISHABLE" && !k.revokedAt,
  );
  const appUrl = env.NEXT_PUBLIC_APP_URL;

  const snippet = `<script
  src="${appUrl}/sdk.js"
  data-project-key="${publishable?.keyPlain ?? "pk_your_key_here"}">
</script>`;

  const serverExample = `curl -X POST ${appUrl}/api/v1/events \\
  -H "Authorization: Bearer sk_your_secret_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "event_name": "purchase_completed",
    "anonymous_id": "anon_123",
    "identify": { "email": "buyer@example.com" },
    "revenue": { "amount": 149.00, "currency": "EUR" }
  }'`;

  return (
    <>
      <PageHeader
        title="Integrációk"
        description="Adatforrások és kapcsolatok. A böngészős mérőkód a viselkedést, a szerveroldali forrás a hiteles bevételi adatokat biztosítja."
      />

      <PageBody>
        {ctx.role === "OWNER" || ctx.role === "ADMIN" ? (
          <Card>
            <CardHeader>
              <CardTitle>API-kulcs létrehozása</CardTitle>
            </CardHeader>
            <CardContent>
              <ConfigForm action={createKey} submitLabel="Kulcs létrehozása">
                <input type="hidden" name="projectId" value={ctx.projectId} />
                <Label htmlFor="keyName">Kulcs neve</Label>
                <Input id="keyName" name="name" required maxLength={100} />
                <Label htmlFor="keyType">Kulcs típusa</Label>
                <select
                  id="keyType"
                  name="type"
                  className="block rounded-md border bg-surface p-2"
                >
                  <option value="SECRET">Titkos szerverkulcs</option>
                  <option value="PUBLISHABLE">Nyilvános böngészőkulcs</option>
                </select>
              </ConfigForm>
            </CardContent>
          </Card>
        ) : null}
        {ctx.role === "OWNER" || ctx.role === "ADMIN"
          ? ["stripe", "webhook"].map((provider) => (
              <Card key={provider}>
                <CardHeader>
                  <CardTitle>
                    {provider === "stripe"
                      ? "Stripe beállítása"
                      : "Általános webhook beállítása"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ConfigForm
                    action={saveIntegration}
                    submitLabel={`${provider === "stripe" ? "Stripe" : "Webhook"} mentése`}
                  >
                    <input
                      type="hidden"
                      name="projectId"
                      value={ctx.projectId}
                    />
                    <input type="hidden" name="provider" value={provider} />
                    <Label htmlFor={`${provider}Secret`}>Aláírási titok</Label>
                    <Input
                      id={`${provider}Secret`}
                      name="secret"
                      type="password"
                      autoComplete="new-password"
                      placeholder="Hagyd üresen a mentett titok megtartásához"
                    />
                    {provider === "webhook" ? (
                      <>
                        <Label htmlFor="signatureHeader">
                          Aláírás fejlécének neve
                        </Label>
                        <Input
                          id="signatureHeader"
                          name="signatureHeader"
                          placeholder="x-signature (üresen hagyva a mentett fejléc marad)"
                        />
                        <Label htmlFor="mapping">
                          JSON-mezők megfeleltetése
                        </Label>
                        <textarea
                          id="mapping"
                          name="mapping"
                          className="block min-h-32 w-full rounded-md border bg-surface p-2 font-mono text-xs"
                          placeholder={
                            '{"event_name":"=call_booked","event_id":"id","email":"email"}'
                          }
                        />
                        <p className="text-xs text-muted-foreground">
                          Üresen hagyva megmarad a mentett mezőmegfeleltetés.
                        </p>
                      </>
                    ) : null}
                  </ConfigForm>
                  {connected.some(
                    (i) =>
                      i.provider === provider && i.status !== "DISCONNECTED",
                  ) ? (
                    <div className="mt-4">
                      <ConfigForm
                        action={saveIntegration}
                        submitLabel={`${provider === "stripe" ? "Stripe" : "Webhook"} leválasztása`}
                        confirmation="Leállítod az ebből az integrációból érkező adatok fogadását?"
                      >
                        <input
                          type="hidden"
                          name="projectId"
                          value={ctx.projectId}
                        />
                        <input
                          type="hidden"
                          name="provider"
                          value={provider}
                        />
                        <input
                          type="hidden"
                          name="operation"
                          value="disconnect"
                        />
                      </ConfigForm>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ))
          : null}
        <Card>
          <CardHeader>
            <CardTitle>Mérőkód telepítése</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs leading-relaxed text-muted-foreground">
              Illeszd be minden oldalba, lehetőleg a head szakaszba.
              Automatikusan rögzíti az oldalmegtekintést, kezeli a
              munkameneteket és az UTM-paramétereket, a sikertelen küldést pedig
              újrapróbálja.
            </p>
            <pre className="overflow-x-auto rounded-md bg-surface-muted px-3 py-2.5 font-mono text-2xs leading-relaxed">
              {snippet}
            </pre>

            <p className="pt-2 text-xs font-medium">Ezután a saját kódodban:</p>
            <pre className="overflow-x-auto rounded-md bg-surface-muted px-3 py-2.5 font-mono text-2xs leading-relaxed">
              {`funnel.identify({ email: "buyer@example.com" })
funnel.track("lead_created", { leadMagnet: "AI Guide" })
funnel.track("purchase_completed", {}, {
  revenue: { amount: 149.00, currency: "EUR" }
})`}
            </pre>

            <p className="text-2xs leading-relaxed text-subtle-foreground">
              Hívd meg az identify függvényt, amint ismert a látogató
              személyazonossága. A korábbi anonim aktivitás így kapcsolódik az
              ügyfélútjához, és lehetővé válik az első érintés szerinti
              attribúció.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Szerveroldali események</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs leading-relaxed text-muted-foreground">
              A bevételi eseményeket a háttérrendszerből küldd. Így a böngésző
              bezárása, egy hirdetésblokkoló vagy hibás átirányítás nem szakítja
              meg a rögzítést.
            </p>
            <pre className="overflow-x-auto rounded-md bg-surface-muted px-3 py-2.5 font-mono text-2xs leading-relaxed">
              {serverExample}
            </pre>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Webhookok</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-xs font-medium">Stripe</p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Add meg ezt a végpontot a Stripe kezelőfelületén, majd mentsd az
                aláírási titkot az integrációhoz. A csatlakoztatott Stripe
                adatai adják a bevétel hiteles forrását; a böngészős
                vásárlásokat ezekkel egyeztetjük.
              </p>
              <pre className="overflow-x-auto rounded-md bg-surface-muted px-3 py-2.5 font-mono text-2xs">
                {`${appUrl}/api/webhooks/stripe?project=${ctx.projectId}`}
              </pre>
              <p className="text-2xs text-subtle-foreground">
                Kezelt események: checkout.session.completed,
                payment_intent.succeeded, charge.refunded,
                invoice.payment_succeeded, customer.subscription.*
              </p>
            </div>

            <div className="space-y-2 border-t border-border pt-4">
              <p className="text-xs font-medium">Általános webhook</p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Más rendszerek csatlakoztatásához. Az aláírási titok és a
                mezőmegfeleltetés alapján a beérkező adatokat eseménnyé
                alakítjuk.
              </p>
              <pre className="overflow-x-auto rounded-md bg-surface-muted px-3 py-2.5 font-mono text-2xs">
                {`${appUrl}/api/webhooks/webhook?project=${ctx.projectId}`}
              </pre>
              <pre className="overflow-x-auto rounded-md bg-surface-muted px-3 py-2.5 font-mono text-2xs leading-relaxed">
                {`{
  "secret": "your-signing-secret",
  "signatureHeader": "x-signature",
  "mapping": {
    "event_name": "=call_booked",
    "event_id": "payload.event.uuid",
    "email": "payload.invitee.email",
    "timestamp": "payload.created_at"
  }
}`}
              </pre>
              <p className="text-2xs leading-relaxed text-subtle-foreground">
                Az ezzel kezdődő érték: <code className="font-mono">=</code>{" "}
                rögzített szöveg; minden más pontozott mezőútvonal a beküldött
                adatokban. Az érvényes aláírás nélküli kéréseket elutasítjuk.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>API-kulcsok</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <thead>
                <tr>
                  <Th>Név</Th>
                  <Th>Típus</Th>
                  <Th>Kulcs</Th>
                  <Th>Utolsó használat</Th>
                  <Th>Állapot / művelet</Th>
                </tr>
              </thead>
              <tbody>
                {keys.map((key) => (
                  <tr key={key.id}>
                    <Td>{key.name}</Td>
                    <Td>
                      <Badge
                        tone={key.type === "SECRET" ? "warning" : "neutral"}
                      >
                        {displayLabel(key.type)}
                      </Badge>
                    </Td>
                    <Td className="font-mono text-2xs">
                      {key.type === "PUBLISHABLE"
                        ? key.keyPlain
                        : `sk_…${key.keyLast4}`}
                    </Td>
                    <Td className="text-2xs text-muted-foreground">
                      {key.lastUsedAt
                        ? formatDate(key.lastUsedAt, ctx.timezone)
                        : "még nem használták"}
                    </Td>
                    <Td>
                      {key.revokedAt ? (
                        "Visszavonva"
                      ) : ctx.role === "OWNER" || ctx.role === "ADMIN" ? (
                        <ConfigForm
                          action={revokeKey}
                          submitLabel="Visszavonás"
                          confirmation="Visszavonod ezt a kulcsot? Az ezt használó adatküldés leáll."
                        >
                          <input
                            type="hidden"
                            name="projectId"
                            value={ctx.projectId}
                          />
                          <input type="hidden" name="keyId" value={key.id} />
                        </ConfigForm>
                      ) : (
                        "Aktív"
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>

            <p className="mt-3 text-2xs leading-relaxed text-subtle-foreground">
              A nyilvános kulcs csak eseményeket küldhet, ezért böngészőben is
              használható. A titkos kulcsot csak létrehozáskor mutatjuk meg, és
              kizárólag a hashét tároljuk. Elveszett kulcs helyett újat kell
              létrehozni.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Csatlakoztatott források</CardTitle>
          </CardHeader>
          <CardContent>
            {connected.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Még nincs külső adatforrás csatlakoztatva. A bevétel jelenleg
                csak az API-n keresztül küldött eseményekből származik.
              </p>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Szolgáltató</Th>
                    <Th>Állapot</Th>
                    <Th className="text-right">Események</Th>
                    <Th>Utolsó esemény</Th>
                  </tr>
                </thead>
                <tbody>
                  {connected.map((integration) => (
                    <tr key={integration.id}>
                      <Td>{integration.displayName}</Td>
                      <Td>
                        <Badge
                          tone={
                            integration.status === "DISCONNECTED"
                              ? "neutral"
                              : integration.status === "ERROR"
                                ? "negative"
                                : "positive"
                          }
                        >
                          {displayLabel(integration.status)}
                        </Badge>
                      </Td>
                      <Td numeric>{integration.eventsReceived}</Td>
                      <Td className="text-2xs text-muted-foreground">
                        {integration.lastEventAt
                          ? formatDate(integration.lastEventAt, ctx.timezone)
                          : "—"}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </CardContent>
        </Card>
      </PageBody>
    </>
  );
}
