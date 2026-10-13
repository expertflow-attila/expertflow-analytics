import { and, desc, eq, gte, lte } from "drizzle-orm";

import { DemoDataBanner, PageBody, PageHeader, StatTile } from "@/components/page";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, Table, Td, Th } from "@/components/ui/primitives";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils";
import {
  isDemoDataset,
  resolveProjectContext,
  resolveRange,
} from "@/server/analytics/context";
import { loadOverview, previousRange } from "@/server/analytics/queries";
import { db } from "@/server/db";
import { orders, persons } from "@/server/db/schema";
import { reconcileRevenue } from "@/server/revenue/service";

export const metadata = { title: "Revenue" };
export const dynamic = "force-dynamic";

export default async function RevenuePage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { range: rangeParam } = await searchParams;
  const ctx = await resolveProjectContext();
  const { range } = resolveRange(rangeParam);

  const [current, prior, demo, reconciliation] = await Promise.all([
    loadOverview(ctx, range),
    loadOverview(ctx, previousRange(range)),
    isDemoDataset(ctx),
    reconcileRevenue(db, ctx.projectId, range),
  ]);

  const recent = await db
    .select({
      id: orders.id,
      occurredAt: orders.occurredAt,
      grossMinor: orders.grossMinor,
      refundedMinor: orders.refundedMinor,
      currency: orders.currency,
      productName: orders.productName,
      source: orders.source,
      personName: persons.name,
      personEmail: persons.email,
      personId: persons.id,
    })
    .from(orders)
    .leftJoin(persons, eq(persons.id, orders.personId))
    .where(
      and(
        eq(orders.projectId, ctx.projectId),
        gte(orders.occurredAt, range.from),
        lte(orders.occurredAt, range.to),
      ),
    )
    .orderBy(desc(orders.occurredAt))
    .limit(40);

  const formatter = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeZone: ctx.timezone,
  });

  const delta = (a: number, b: number) => {
    if (b === 0) return { label: "—", value: null };
    const change = (a - b) / b;
    return {
      label: `${change > 0 ? "+" : ""}${(change * 100).toFixed(1)}%`,
      value: change,
    };
  };

  return (
    <>
      <PageHeader
        title="Revenue"
        description="Canonical revenue from connected payment sources. Browser purchase events are never treated as the source of truth when a server-side record exists."
      />

      <PageBody>
        {demo ? <DemoDataBanner /> : null}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="Gross revenue"
            value={formatCurrency(current.grossRevenueMinor, ctx.baseCurrency, {
              compact: true,
            })}
            delta={delta(current.grossRevenueMinor, prior.grossRevenueMinor)}
          />
          <StatTile
            label="Refunded"
            value={formatCurrency(current.refundedMinor, ctx.baseCurrency, {
              compact: true,
            })}
            tone={current.refundedMinor > 0 ? "negative" : "neutral"}
          />
          <StatTile
            label="Net revenue"
            value={formatCurrency(current.netRevenueMinor, ctx.baseCurrency, {
              compact: true,
            })}
            delta={delta(current.netRevenueMinor, prior.netRevenueMinor)}
          />
          <StatTile
            label="Orders"
            value={formatNumber(current.ordersCount)}
            delta={delta(current.ordersCount, prior.ordersCount)}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="Average order value"
            value={formatCurrency(current.averageOrderValueMinor, ctx.baseCurrency)}
          />
          <StatTile
            label="Revenue per visitor"
            value={formatCurrency(current.revenuePerVisitorMinor, ctx.baseCurrency)}
          />
          <StatTile
            label="MRR"
            value={
              current.mrrMinor === 0
                ? "—"
                : formatCurrency(current.mrrMinor, ctx.baseCurrency, {
                    compact: true,
                  })
            }
            hint={current.mrrMinor === 0 ? "no active subscriptions" : undefined}
          />
          <StatTile
            label="ARR"
            value={
              current.mrrMinor === 0
                ? "—"
                : formatCurrency(current.mrrMinor * 12, ctx.baseCurrency, {
                    compact: true,
                  })
            }
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Reconciliation</CardTitle>
          </CardHeader>
          <CardContent>
            {reconciliation.browserPurchaseEvents === 0 &&
            reconciliation.canonicalOrders === 0 ? (
              <p className="text-xs text-muted-foreground">
                Nothing to reconcile in this period.
              </p>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <p className="text-2xs font-medium tracking-wide text-muted-foreground uppercase">
                      Provider records
                    </p>
                    <p className="tabular mt-1 text-sm font-medium">
                      {formatNumber(reconciliation.canonicalOrders)} orders ·{" "}
                      {formatCurrency(
                        reconciliation.canonicalRevenueMinor,
                        ctx.baseCurrency,
                        { compact: true },
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-2xs font-medium tracking-wide text-muted-foreground uppercase">
                      Browser events
                    </p>
                    <p className="tabular mt-1 text-sm font-medium">
                      {formatNumber(reconciliation.browserPurchaseEvents)} events ·{" "}
                      {formatCurrency(
                        reconciliation.browserRevenueMinor,
                        ctx.baseCurrency,
                        { compact: true },
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-2xs font-medium tracking-wide text-muted-foreground uppercase">
                      Match rate
                    </p>
                    <p className="tabular mt-1 text-sm font-medium">
                      {reconciliation.matchRate === null
                        ? "—"
                        : formatPercent(reconciliation.matchRate)}
                    </p>
                  </div>
                </div>

                {reconciliation.browserEventsWithoutOrder > 0 ||
                reconciliation.ordersWithoutPerson > 0 ? (
                  <ul className="mt-4 space-y-1.5 border-t border-border pt-3 text-xs">
                    {reconciliation.browserEventsWithoutOrder > 0 ? (
                      <li className="text-muted-foreground">
                        <span className="font-medium text-foreground">
                          {formatNumber(reconciliation.browserEventsWithoutOrder)}
                        </span>{" "}
                        browser purchase{" "}
                        {reconciliation.browserEventsWithoutOrder === 1
                          ? "event has"
                          : "events have"}{" "}
                        no matching provider record within 24 hours. Either the
                        payment never completed, or the buyer was not identified
                        at checkout.
                      </li>
                    ) : null}
                    {reconciliation.ordersWithoutPerson > 0 ? (
                      <li className="text-muted-foreground">
                        <span className="font-medium text-foreground">
                          {formatNumber(reconciliation.ordersWithoutPerson)}
                        </span>{" "}
                        provider{" "}
                        {reconciliation.ordersWithoutPerson === 1
                          ? "order could"
                          : "orders could"}{" "}
                        not be matched to a person, so{" "}
                        {reconciliation.ordersWithoutPerson === 1
                          ? "it is"
                          : "they are"}{" "}
                        excluded from attribution and LTV.
                      </li>
                    ) : null}
                  </ul>
                ) : null}

                <p className="mt-3 text-2xs leading-relaxed text-subtle-foreground">
                  Where a payment provider is connected its record is canonical.
                  Browser purchase events are compared against it rather than
                  trusted: an ad blocker or closed tab loses one, a double-fired
                  tag invents one.
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent orders</CardTitle>
          </CardHeader>
          <CardContent>
            {recent.length === 0 ? (
              <EmptyState
                title="No revenue recorded in this period"
                description="Connect Stripe, post orders to the events API, or import a CSV so revenue can be joined to customer journeys."
              />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Date</Th>
                    <Th>Customer</Th>
                    <Th>Product</Th>
                    <Th>Source</Th>
                    <Th className="text-right">Gross</Th>
                    <Th className="text-right">Net</Th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((order) => (
                    <tr key={order.id}>
                      <Td>{formatter.format(order.occurredAt)}</Td>
                      <Td>
                        {order.personId ? (
                          <a
                            href={`/customers/${order.personId}`}
                            className="text-accent hover:underline"
                          >
                            {order.personName ?? order.personEmail}
                          </a>
                        ) : (
                          <span className="text-subtle-foreground">
                            unmatched
                          </span>
                        )}
                      </Td>
                      <Td>{order.productName ?? "—"}</Td>
                      <Td className="text-2xs text-muted-foreground">
                        {order.source}
                      </Td>
                      <Td numeric>
                        {formatCurrency(order.grossMinor, order.currency)}
                      </Td>
                      <Td numeric>
                        {formatCurrency(
                          order.grossMinor - order.refundedMinor,
                          order.currency,
                        )}
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
