import { eq } from "drizzle-orm";

import { PageBody, PageHeader } from "@/components/page";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, Table, Td, Th } from "@/components/ui/primitives";
import { env } from "@/env";
import { resolveProjectContext } from "@/server/analytics/context";
import { db } from "@/server/db";
import { apiKeys, integrations } from "@/server/db/schema";

export const metadata = { title: "Integrations" };
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

  const publishable = keys.find((k) => k.type === "PUBLISHABLE");
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
        title="Integrations"
        description="How data gets in. The browser SDK covers behaviour; a server-side source is what makes revenue trustworthy."
      />

      <PageBody>
        <Card>
          <CardHeader>
            <CardTitle>Install the tracking script</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs leading-relaxed text-muted-foreground">
              Add this to every page, ideally in the head. It sends a page view
              automatically, handles sessions, persists UTM parameters and
              retries failed sends.
            </p>
            <pre className="overflow-x-auto rounded-md bg-surface-muted px-3 py-2.5 font-mono text-2xs leading-relaxed">
              {snippet}
            </pre>

            <p className="pt-2 text-xs font-medium">Then, in your own code:</p>
            <pre className="overflow-x-auto rounded-md bg-surface-muted px-3 py-2.5 font-mono text-2xs leading-relaxed">
              {`funnel.identify({ email: "buyer@example.com" })
funnel.track("lead_created", { leadMagnet: "AI Guide" })
funnel.track("purchase_completed", {}, {
  revenue: { amount: 149.00, currency: "EUR" }
})`}
            </pre>

            <p className="text-2xs leading-relaxed text-subtle-foreground">
              Call identify as early as you know who someone is. Everything they
              did anonymously beforehand is then joined onto their journey, which
              is what makes first-touch attribution possible.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Server-side events</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs leading-relaxed text-muted-foreground">
              Send revenue from your backend rather than the browser. A purchase
              recorded server-side cannot be lost to an ad blocker, a closed tab
              or a failed redirect.
            </p>
            <pre className="overflow-x-auto rounded-md bg-surface-muted px-3 py-2.5 font-mono text-2xs leading-relaxed">
              {serverExample}
            </pre>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>API keys</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <thead>
                <tr>
                  <Th>Name</Th>
                  <Th>Type</Th>
                  <Th>Key</Th>
                  <Th>Last used</Th>
                </tr>
              </thead>
              <tbody>
                {keys.map((key) => (
                  <tr key={key.id}>
                    <Td>{key.name}</Td>
                    <Td>
                      <Badge tone={key.type === "SECRET" ? "warning" : "neutral"}>
                        {key.type.toLowerCase()}
                      </Badge>
                    </Td>
                    <Td className="font-mono text-2xs">
                      {key.type === "PUBLISHABLE"
                        ? key.keyPlain
                        : `sk_…${key.keyLast4}`}
                    </Td>
                    <Td className="text-2xs text-muted-foreground">
                      {key.lastUsedAt
                        ? key.lastUsedAt.toISOString().slice(0, 10)
                        : "never"}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>

            <p className="mt-3 text-2xs leading-relaxed text-subtle-foreground">
              The publishable key is safe in a browser — it can only write events.
              Secret keys are stored hashed and shown once at creation; if one is
              lost it must be replaced rather than recovered.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Connected sources</CardTitle>
          </CardHeader>
          <CardContent>
            {connected.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No external source is connected. Revenue currently comes only
                from events sent to the API.
              </p>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Provider</Th>
                    <Th>Status</Th>
                    <Th className="text-right">Events</Th>
                    <Th>Last event</Th>
                  </tr>
                </thead>
                <tbody>
                  {connected.map((integration) => (
                    <tr key={integration.id}>
                      <Td>{integration.displayName}</Td>
                      <Td>
                        <Badge
                          tone={
                            integration.errorCount > 0 ? "negative" : "positive"
                          }
                        >
                          {integration.status.toLowerCase()}
                        </Badge>
                      </Td>
                      <Td numeric>{integration.eventsReceived}</Td>
                      <Td className="text-2xs text-muted-foreground">
                        {integration.lastEventAt
                          ? integration.lastEventAt.toISOString().slice(0, 10)
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
