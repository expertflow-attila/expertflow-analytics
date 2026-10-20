import { displayLabel } from "@/lib/labels";
import Link from "next/link";

import { DemoDataBanner, PageBody, PageHeader } from "@/components/page";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, EmptyState, Table, Td, Th } from "@/components/ui/primitives";
import { calculateCohorts, LTV_HORIZONS } from "@/lib/analytics/ltv-core";
import { formatCurrency } from "@/lib/utils";
import {
  isDemoDataset,
  resolveProjectContext,
} from "@/server/analytics/context";
import { loadCustomers } from "@/server/analytics/queries";

export const metadata = { title: "Kohorszok és ügyfélérték" };
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
        title="Kohorszok és ügyfélérték"
        description="A megszerzett ügyfelekre jutó összesített nettó bevétel, rögzített napeltolásokkal. Csak a kohorsz minden tagjánál már lezárult időtávhoz jelenik meg érték."
        actions={
          <div className="flex gap-1">
            {[
              { key: "month", label: "Hónap szerint" },
              { key: "channel", label: "Csatorna szerint" },
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
            title="Még nincsenek kohorszok"
            description="A kohorsz az ügyfelek első vásárlásakor jön létre. Csatlakoztass fizetési forrást az ügyfélszerzés szerinti bevételi elemzéshez."
          />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>
                {cohortBy === "month"
                  ? "Ügyfélszerzés hónapja"
                  : "Ügyfélszerző csatorna"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <thead>
                  <tr>
                    <Th>Kohorsz</Th>
                    <Th className="text-right">Ügyfelek</Th>
                    {LTV_HORIZONS.map((horizon) => (
                      <Th key={horizon} className="text-right">
                        {horizon} napos ügyfélérték
                      </Th>
                    ))}
                    <Th className="text-right">Teljes időszak</Th>
                    <Th className="text-right">CAC</Th>
                    <Th className="text-right">Megtérülés</Th>
                  </tr>
                </thead>
                <tbody>
                  {cohorts.map((cohort) => (
                    <tr key={cohort.cohortKey}>
                      <Td>{displayLabel(cohort.cohortKey)}</Td>
                      <Td numeric>{cohort.customers}</Td>
                      {LTV_HORIZONS.map((horizon) => (
                        <Td key={horizon} numeric>
                          {cohort.ltvByHorizon[horizon] === null ? (
                            <span
                              className="text-subtle-foreground"
                              title="Ez az időtáv még nem telt el a kohorsz minden ügyfelénél"
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
                          <Badge tone="neutral">Nem elérhető</Badge>
                        ) : (
                          formatCurrency(cohort.cac, ctx.baseCurrency)
                        )}
                      </Td>
                      <Td numeric>
                        {cohort.paybackStatus === "UNAVAILABLE" ? (
                          <span className="text-subtle-foreground">—</span>
                        ) : cohort.paybackStatus === "REACHED" ? (
                          `${cohort.paybackDays} nap`
                        ) : (
                          <span className="text-negative">
                            még nem térült meg
                          </span>
                        )}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>

              <p className="mt-4 text-2xs leading-relaxed text-subtle-foreground">
                Az ügyfélszerzési költséghez és a megtérüléshez marketingköltési
                adatok szükségesek. Jelenleg nincs ilyen csatlakoztatott
                adatforrás, ezért becslés helyett nem elérhető értéket mutatunk.
              </p>
            </CardContent>
          </Card>
        )}
      </PageBody>
    </>
  );
}
