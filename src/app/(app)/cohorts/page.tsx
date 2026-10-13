import Link from "next/link";

import { DemoDataBanner, PageBody, PageHeader } from "@/components/page";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, EmptyState, Table, Td, Th } from "@/components/ui/primitives";
import { calculateCohorts, LTV_HORIZONS } from "@/lib/analytics/ltv-core";
import { formatCurrency } from "@/lib/utils";
import { isDemoDataset, resolveProjectContext } from "@/server/analytics/context";
import { loadCustomers } from "@/server/analytics/queries";

export const metadata = { title: "Cohorts & LTV" };
export const dynamic = "force-dynamic";

export default async function CohortsPage({
  searchParams,
}: {
  searchParams: Promise<{ by?: string }>;
}) {
  const { by } = await searchParams;
  const cohortBy = by === "channel" ? "channel" : "month";

  const ctx = await resolveProjectContext();
  const customers = await loadCustomers(ctx, cohortBy);
  const cohorts = calculateCohorts(customers);
  const demo = await isDemoDataset(ctx);

  return (
    <>
      <PageHeader
        title="Cohorts & LTV"
        description="Cumulative net revenue per acquired customer, measured at fixed day offsets. A horizon shows a value only once it has fully elapsed for that cohort."
        actions={
          <div className="flex gap-1">
            {[
              { key: "month", label: "By month" },
              { key: "channel", label: "By channel" },
            ].map((option) => (
              <Link
                key={option.key}
                href={`/cohorts?by=${option.key}`}
                className={
                  cohortBy === option.key
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

        {cohorts.length === 0 ? (
          <EmptyState
            title="No cohorts yet"
            description="A cohort forms when customers make their first purchase. Connect a payment source so revenue can be grouped by acquisition."
          />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>
                {cohortBy === "month" ? "Acquisition month" : "Acquisition channel"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <thead>
                  <tr>
                    <Th>Cohort</Th>
                    <Th className="text-right">Customers</Th>
                    {LTV_HORIZONS.map((horizon) => (
                      <Th key={horizon} className="text-right">
                        {horizon}d LTV
                      </Th>
                    ))}
                    <Th className="text-right">Lifetime</Th>
                    <Th className="text-right">CAC</Th>
                    <Th className="text-right">Payback</Th>
                  </tr>
                </thead>
                <tbody>
                  {cohorts.map((cohort) => (
                    <tr key={cohort.cohortKey}>
                      <Td>{cohort.cohortKey}</Td>
                      <Td numeric>{cohort.customers}</Td>
                      {LTV_HORIZONS.map((horizon) => (
                        <Td key={horizon} numeric>
                          {cohort.ltvByHorizon[horizon] === null ? (
                            <span
                              className="text-subtle-foreground"
                              title="This horizon has not fully elapsed for every customer in the cohort"
                            >
                              —
                            </span>
                          ) : (
                            formatCurrency(
                              cohort.ltvByHorizon[horizon],
                              ctx.baseCurrency,
                              { compact: true },
                            )
                          )}
                        </Td>
                      ))}
                      <Td numeric>
                        {formatCurrency(
                          cohort.lifetimeLtvMinor,
                          ctx.baseCurrency,
                          { compact: true },
                        )}
                      </Td>
                      <Td numeric>
                        {cohort.cac === null ? (
                          <Badge tone="neutral">Unavailable</Badge>
                        ) : (
                          formatCurrency(cohort.cac, ctx.baseCurrency)
                        )}
                      </Td>
                      <Td numeric>
                        {cohort.paybackStatus === "UNAVAILABLE" ? (
                          <span className="text-subtle-foreground">—</span>
                        ) : cohort.paybackStatus === "REACHED" ? (
                          `${cohort.paybackDays}d`
                        ) : (
                          <span className="text-negative">not reached</span>
                        )}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>

              <p className="mt-4 text-2xs leading-relaxed text-subtle-foreground">
                CAC and payback need marketing spend, which no connected source
                is currently providing. They are reported as unavailable rather
                than estimated — a guessed acquisition cost would make every
                payback figure on this page fiction.
              </p>
            </CardContent>
          </Card>
        )}
      </PageBody>
    </>
  );
}
