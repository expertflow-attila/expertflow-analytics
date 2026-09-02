import { notFound } from "next/navigation";

import { PageBody, PageHeader } from "@/components/page";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, EmptyState } from "@/components/ui/primitives";
import { eventLabel } from "@/lib/events/taxonomy";
import { formatCurrency } from "@/lib/utils";
import { resolveProjectContext } from "@/server/analytics/context";
import { loadJourney } from "@/server/analytics/queries";

export const dynamic = "force-dynamic";

export default async function CustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await resolveProjectContext();
  const data = await loadJourney(ctx, id);

  if (!data) notFound();

  const { person, timeline, touchpoints, orders } = data;
  const formatter = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: ctx.timezone,
  });

  return (
    <>
      <PageHeader
        title={person.name ?? person.email ?? person.id}
        description={
          person.email && person.name ? person.email : `Person ${person.id}`
        }
      />

      <PageBody>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-[var(--radius-card)] border border-border bg-surface px-4 py-3">
            <p className="text-2xs font-medium tracking-wide text-muted-foreground uppercase">
              Lifetime revenue
            </p>
            <p className="tabular mt-1 text-lg font-semibold">
              {formatCurrency(person.lifetimeRevenueMinor, ctx.baseCurrency)}
            </p>
          </div>
          <div className="rounded-[var(--radius-card)] border border-border bg-surface px-4 py-3">
            <p className="text-2xs font-medium tracking-wide text-muted-foreground uppercase">
              First seen
            </p>
            <p className="mt-1 text-sm">
              {person.firstSeenAt ? formatter.format(person.firstSeenAt) : "—"}
            </p>
          </div>
          <div className="rounded-[var(--radius-card)] border border-border bg-surface px-4 py-3">
            <p className="text-2xs font-medium tracking-wide text-muted-foreground uppercase">
              Orders
            </p>
            <p className="tabular mt-1 text-lg font-semibold">{orders.length}</p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              {timeline.length === 0 ? (
                <EmptyState
                  title="No events recorded"
                  description="This person has no events in the retention window."
                />
              ) : (
                <ol className="relative space-y-4 border-l border-border pl-5">
                  {timeline.map((event, index) => (
                    <li key={`${event.eventName}-${index}`} className="relative">
                      <span
                        className={
                          event.revenueMinor
                            ? "absolute top-1.5 -left-[1.4rem] size-2 rounded-full bg-positive"
                            : "absolute top-1.5 -left-[1.4rem] size-2 rounded-full bg-border-strong"
                        }
                        aria-hidden
                      />
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="text-sm font-medium">
                          {eventLabel(event.eventName)}
                        </p>
                        <time className="text-2xs text-muted-foreground">
                          {formatter.format(event.timestamp)}
                        </time>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {[
                          event.channel,
                          event.utmCampaign,
                          event.pagePath,
                          event.revenueMinor
                            ? formatCurrency(event.revenueMinor, ctx.baseCurrency)
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Touchpoints</CardTitle>
              </CardHeader>
              <CardContent>
                {touchpoints.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No marketing touchpoints recorded.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {touchpoints.map((touchpoint) => (
                      <li key={touchpoint.id} className="text-xs">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="font-medium">
                            {touchpoint.channel}
                          </span>
                          {touchpoint.isLeadConversion === "true" ? (
                            <Badge tone="accent">lead</Badge>
                          ) : null}
                        </div>
                        <p className="text-muted-foreground">
                          {formatter.format(touchpoint.occurredAt)}
                          {touchpoint.campaign ? ` · ${touchpoint.campaign}` : ""}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Orders</CardTitle>
              </CardHeader>
              <CardContent>
                {orders.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No purchases recorded.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {orders.map((order) => (
                      <li
                        key={order.id}
                        className="flex items-baseline justify-between gap-2 text-xs"
                      >
                        <span className="min-w-0 truncate">
                          {order.productName ?? "Purchase"}
                        </span>
                        <span className="tabular shrink-0 font-medium">
                          {formatCurrency(order.grossMinor, order.currency)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </PageBody>
    </>
  );
}
