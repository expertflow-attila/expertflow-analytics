import { formatRelativeChange } from "@/lib/utils";
import { and, desc, eq, gte, lte } from "drizzle-orm";

import {
  DemoDataBanner,
  PageBody,
  PageHeader,
  StatTile,
} from "@/components/page";
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

export const metadata = { title: "Bevétel" };
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

  const formatter = new Intl.DateTimeFormat("hu-HU", {
    dateStyle: "medium",
    timeZone: ctx.timezone,
  });

  const delta = formatRelativeChange;

  return (
    <>
      <PageHeader
        title="Bevétel"
        description="A csatlakoztatott fizetési források hiteles bevétele. Ha van szerveroldali rendelés, a böngészős vásárlási eseményeket ahhoz egyeztetjük."
      />

      <PageBody>
        {demo ? <DemoDataBanner /> : null}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="Bruttó bevétel"
            value={formatCurrency(current.grossRevenueMinor, ctx.baseCurrency, {
              compact: true,
            })}
            delta={delta(current.grossRevenueMinor, prior.grossRevenueMinor)}
          />
          <StatTile
            label="Visszatérítések"
            value={formatCurrency(current.refundedMinor, ctx.baseCurrency, {
              compact: true,
            })}
            tone={current.refundedMinor > 0 ? "negative" : "neutral"}
          />
          <StatTile
            label="Nettó bevétel"
            value={formatCurrency(current.netRevenueMinor, ctx.baseCurrency, {
              compact: true,
            })}
            delta={delta(current.netRevenueMinor, prior.netRevenueMinor)}
          />
          <StatTile
            label="Rendelések"
            value={formatNumber(current.ordersCount)}
            delta={delta(current.ordersCount, prior.ordersCount)}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="Átlagos rendelési érték"
            value={formatCurrency(
              current.averageOrderValueMinor,
              ctx.baseCurrency,
            )}
          />
          <StatTile
            label="Bevétel látogatónként"
            value={formatCurrency(
              current.revenuePerVisitorMinor,
              ctx.baseCurrency,
            )}
          />
          <StatTile
            label="Havi ismétlődő bevétel"
            value={
              current.mrrMinor === 0
                ? "—"
                : formatCurrency(current.mrrMinor, ctx.baseCurrency, {
                    compact: true,
                  })
            }
            hint={current.mrrMinor === 0 ? "nincs aktív előfizetés" : undefined}
          />
          <StatTile
            label="Éves ismétlődő bevétel"
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
            <CardTitle>Bevétel-egyeztetés</CardTitle>
          </CardHeader>
          <CardContent>
            {reconciliation.browserPurchaseEvents === 0 &&
            reconciliation.canonicalOrders === 0 ? (
              <p className="text-xs text-muted-foreground">
                Ebben az időszakban nincs egyeztethető adat.
              </p>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <p className="text-2xs font-medium tracking-wide text-muted-foreground uppercase">
                      Fizetési szolgáltató adatai
                    </p>
                    <p className="tabular mt-1 text-sm font-medium">
                      {formatNumber(reconciliation.canonicalOrders)} rendelés ·{" "}
                      {formatCurrency(
                        reconciliation.canonicalRevenueMinor,
                        ctx.baseCurrency,
                        { compact: true },
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-2xs font-medium tracking-wide text-muted-foreground uppercase">
                      Böngészős események
                    </p>
                    <p className="tabular mt-1 text-sm font-medium">
                      {formatNumber(reconciliation.browserPurchaseEvents)}{" "}
                      esemény ·{" "}
                      {formatCurrency(
                        reconciliation.browserRevenueMinor,
                        ctx.baseCurrency,
                        { compact: true },
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-2xs font-medium tracking-wide text-muted-foreground uppercase">
                      Egyezési arány
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
                          {formatNumber(
                            reconciliation.browserEventsWithoutOrder,
                          )}
                        </span>{" "}
                        böngészős vásárlási{" "}
                        {reconciliation.browserEventsWithoutOrder === 1
                          ? "eseményhez"
                          : "eseményhez"}{" "}
                        nem találtunk fizetési rekordot 24 órán belül. Lehet,
                        hogy a fizetés nem fejeződött be, vagy a vevőt nem
                        azonosították a pénztárnál.
                      </li>
                    ) : null}
                    {reconciliation.ordersWithoutPerson > 0 ? (
                      <li className="text-muted-foreground">
                        <span className="font-medium text-foreground">
                          {formatNumber(reconciliation.ordersWithoutPerson)}
                        </span>{" "}
                        szolgáltatói{" "}
                        {reconciliation.ordersWithoutPerson === 1
                          ? "rendelést"
                          : "rendelést"}{" "}
                        nem sikerült személyhez kapcsolni, ezért{" "}
                        {reconciliation.ordersWithoutPerson === 1
                          ? "az"
                          : "azok"}{" "}
                        kimaradnak az attribúcióból és az
                        ügyfélérték-számításból.
                      </li>
                    ) : null}
                  </ul>
                ) : null}

                <p className="mt-3 text-2xs leading-relaxed text-subtle-foreground">
                  Csatlakoztatott fizetési szolgáltatónál annak rekordja a
                  hiteles forrás. A böngészős eseményeket ehhez egyeztetjük: a
                  blokkolók és a bezárt lapok hiányt, a többször lefutó mérőkód
                  duplikációt okozhat.
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Legutóbbi rendelések</CardTitle>
          </CardHeader>
          <CardContent>
            {recent.length === 0 ? (
              <EmptyState
                title="Nincs rögzített bevétel az időszakban"
                description="Csatlakoztasd a Stripe-ot, vagy küldj rendelési eseményeket az API-ra, hogy a bevételt az ügyfélutakhoz kapcsolhassuk."
              />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Dátum</Th>
                    <Th>Ügyfél</Th>
                    <Th>Termék</Th>
                    <Th>Forrás</Th>
                    <Th className="text-right">Bruttó</Th>
                    <Th className="text-right">Nettó</Th>
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
                            nincs egyezés
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
