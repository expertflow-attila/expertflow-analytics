import Link from "next/link";

import { DemoDataBanner, PageBody, PageHeader } from "@/components/page";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, Table, Td, Th } from "@/components/ui/primitives";
import { formatCurrency, formatNumber } from "@/lib/utils";
import {
  isDemoDataset,
  resolveProjectContext,
  resolveRange,
} from "@/server/analytics/context";
import { listJourneys, loadObservedPaths } from "@/server/analytics/queries";

export const metadata = { title: "Journey" };
export const dynamic = "force-dynamic";

export default async function JourneysPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; range?: string }>;
}) {
  const { filter, range: rangeParam } = await searchParams;
  const ctx = await resolveProjectContext();
  const { range } = resolveRange(rangeParam);
  const onlyCustomers = filter === "customers";

  const [people, buyerPaths, allPaths, demo] = await Promise.all([
    listJourneys(ctx, { limit: 50, onlyCustomers }),
    loadObservedPaths(ctx, range, { onlyBuyers: true }),
    loadObservedPaths(ctx, range, { onlyBuyers: false }),
    isDemoDataset(ctx),
  ]);

  return (
    <>
      <PageHeader
        title="Journey"
        description="What people actually did, in the order they did it — independent of any funnel you have drawn."
        actions={
          <div className="flex gap-1">
            {[
              { key: undefined, label: "Everyone" },
              { key: "customers", label: "Customers only" },
            ].map((option) => (
              <Link
                key={option.label}
                href={
                  option.key ? `/journeys?filter=${option.key}` : "/journeys"
                }
                className={
                  filter === option.key
                    ? "rounded-md bg-accent-subtle px-2.5 py-1 text-xs font-medium text-accent"
                    : "rounded-md px-2.5 py-1 text-xs text-muted-foreground hover:bg-surface-muted"
                }
              >
                {option.label}
              </Link>
            ))}
          </div>
        }
      />

      <PageBody>
        {demo ? <DemoDataBanner /> : null}

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Most common buyer paths</CardTitle>
            </CardHeader>
            <CardContent>
              {buyerPaths.length === 0 ? (
                <EmptyState
                  title="No buyer paths yet"
                  description="Buyer paths appear once customers have completed a purchase in this period."
                />
              ) : (
                <ul className="space-y-2.5">
                  {buyerPaths.slice(0, 6).map((path) => (
                    <li key={path.path} className="space-y-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="min-w-0 truncate text-xs text-muted-foreground">
                          {path.path}
                        </span>
                        <span className="tabular shrink-0 text-xs font-medium">
                          {formatNumber(path.people)}
                        </span>
                      </div>
                      <div className="h-1 w-full overflow-hidden rounded-full bg-surface-muted">
                        <div
                          className="h-full rounded-full bg-series-1"
                          style={{
                            width: `${Math.max(2, (path.people / buyerPaths[0].people) * 100)}%`,
                          }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Most common paths overall</CardTitle>
            </CardHeader>
            <CardContent>
              {allPaths.length === 0 ? (
                <EmptyState
                  title="No paths yet"
                  description="Paths are built from identified people. Call identify() so anonymous activity can be joined into a journey."
                />
              ) : (
                <ul className="space-y-2">
                  {allPaths.slice(0, 6).map((path) => (
                    <li
                      key={path.path}
                      className="flex items-baseline justify-between gap-3 border-b border-border pb-2 text-xs last:border-0"
                    >
                      <span className="min-w-0 truncate text-muted-foreground">
                        {path.path}
                      </span>
                      <span className="tabular shrink-0">
                        {formatNumber(path.people)} ·{" "}
                        <span className="text-muted-foreground">
                          {path.buyers} bought
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>
              {onlyCustomers ? "Customers" : "People"} by lifetime revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            {people.length === 0 ? (
              <EmptyState
                title="No identified people yet"
                description="A person appears here once a deterministic identifier — an email, your own user id, or a payment customer id — has been seen for them."
              />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Person</Th>
                    <Th>First touch</Th>
                    <Th>Last touch</Th>
                    <Th className="text-right">Events</Th>
                    <Th className="text-right">Lifetime revenue</Th>
                  </tr>
                </thead>
                <tbody>
                  {people.map((person) => (
                    <tr key={person.id}>
                      <Td>
                        <Link
                          href={`/customers/${person.id}`}
                          className="text-accent hover:underline"
                        >
                          {person.name ?? person.email ?? person.id}
                        </Link>
                      </Td>
                      <Td>{person.firstTouchChannel ?? "—"}</Td>
                      <Td>{person.lastTouchChannel ?? "—"}</Td>
                      <Td numeric>{formatNumber(person.eventCount)}</Td>
                      <Td numeric>
                        {person.lifetimeRevenueMinor > 0
                          ? formatCurrency(
                              person.lifetimeRevenueMinor,
                              ctx.baseCurrency,
                            )
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
