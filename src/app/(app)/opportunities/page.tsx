import { displayLabel } from "@/lib/labels";
import { eq } from "drizzle-orm";

import { DemoDataBanner, PageBody, PageHeader } from "@/components/page";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, EmptyState } from "@/components/ui/primitives";
import {
  rankOpportunities,
  type ImprovementScenario,
} from "@/lib/analytics/opportunity-core";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils";
import {
  isDemoDataset,
  resolveProjectContext,
  resolveRange,
} from "@/server/analytics/context";
import { loadFunnel, rangeDays } from "@/server/analytics/queries";
import { db } from "@/server/db";
import { funnels } from "@/server/db/schema";

export const metadata = { title: "Lehetőségek" };
export const dynamic = "force-dynamic";

const SCENARIOS: Record<
  string,
  { label: string; scenario: ImprovementScenario }
> = {
  target: { label: "Célig", scenario: { kind: "TARGET" } },
  point: {
    label: "+1 százalékpont",
    scenario: { kind: "ABSOLUTE_POINTS", points: 0.01 },
  },
  relative: {
    label: "+10% relative",
    scenario: { kind: "RELATIVE", fraction: 0.1 },
  },
};

export default async function OpportunitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ scenario?: string; range?: string }>;
}) {
  const { scenario: scenarioKey = "target", range: rangeParam } =
    await searchParams;
  const ctx = await resolveProjectContext();
  const { range } = resolveRange(rangeParam);
  const chosen = SCENARIOS[scenarioKey] ?? SCENARIOS.target;

  const [funnel] = await db
    .select({ id: funnels.id })
    .from(funnels)
    .where(eq(funnels.projectId, ctx.projectId))
    .limit(1);

  const data = funnel ? await loadFunnel(ctx, funnel.id, range) : null;
  const demo = await isDemoDataset(ctx);
  const periodDays = rangeDays(range);

  const opportunities = data
    ? rankOpportunities(
        data.result.nodes
          .filter((node) => node.conversionRate !== null)
          .map((node) => ({
            node,
            downstreamRevenuePerConversionMinor:
              node.converted === 0
                ? 0
                : Math.round(node.downstreamRevenueMinor / node.converted),
            periodDays,
            effort: 3,
          })),
        chosen.scenario,
      )
    : [];

  return (
    <>
      <PageHeader
        title="Lehetőségek"
        description="Becsült bevételi hatás szerint rendezve, az adatok megbízhatóságával súlyozva. Az értékek megfigyelt viselkedésből származó becslések, nem előrejelzések."
        actions={
          <div className="flex gap-1">
            {Object.entries(SCENARIOS).map(([key, value]) => (
              <a
                key={key}
                href={`/opportunities?scenario=${key}`}
                className={
                  key === scenarioKey
                    ? "rounded-md bg-accent-subtle px-2.5 py-1 text-xs font-medium text-accent"
                    : "rounded-md px-2.5 py-1 text-xs text-muted-foreground hover:bg-surface-muted"
                }
              >
                {value.label}
              </a>
            ))}
          </div>
        }
      />

      <PageBody>
        {demo ? <DemoDataBanner /> : null}

        {opportunities.length === 0 ? (
          <EmptyState
            title="Még nem becsülhető bevételi lehetőség"
            description="A becsléshez konverziós cél, elegendő belépő és a későbbi lépésekben megfigyelt bevétel szükséges. Először állíts be célértékeket a tölcsér lépéseinél."
          />
        ) : (
          <ul className="space-y-3">
            {opportunities.map((opportunity, index) => (
              <li key={opportunity.nodeId}>
                <Card>
                  <CardContent className="pt-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0 space-y-1">
                        <p className="text-sm font-semibold">
                          <span className="text-muted-foreground">
                            #{index + 1}
                          </span>{" "}
                          {opportunity.nodeName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatPercent(opportunity.currentConversionRate)} →{" "}
                          {formatPercent(opportunity.targetConversionRate)}{" "}
                          érintett: {formatNumber(opportunity.eligibleUsers)}{" "}
                          fő, értékük:{" "}
                          {formatCurrency(
                            opportunity.downstreamRevenuePerConversionMinor,
                            ctx.baseCurrency,
                          )}{" "}
                          fejenként a későbbi lépésekben.
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="tabular text-xl font-semibold tracking-tight">
                          {formatCurrency(
                            opportunity.estimatedMonthlyUpsideMinor,
                            ctx.baseCurrency,
                            { compact: true },
                          )}
                        </p>
                        <p className="text-2xs text-muted-foreground">
                          becsült havi többletbevétel
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <Badge
                        tone={
                          opportunity.confidence === "HIGH"
                            ? "positive"
                            : opportunity.confidence === "MEDIUM"
                              ? "warning"
                              : "neutral"
                        }
                      >
                        {displayLabel(opportunity.confidence)} megbízhatóság
                      </Badge>
                      <span className="text-2xs text-muted-foreground">
                        {opportunity.confidenceReason}
                      </span>
                    </div>

                    {/* The scoring is deliberately visible. A ranking nobody
                        can interrogate is a ranking nobody should act on. */}
                    <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1.5 border-t border-border pt-3 sm:grid-cols-5">
                      {[
                        {
                          label: "Pontszám",
                          value: opportunity.opportunityScore,
                        },
                        {
                          label: "Bevételi hatás",
                          value: opportunity.revenueImpactScore,
                        },
                        { label: "Elérés", value: opportunity.reachScore },
                        {
                          label: "Tartósság",
                          value: opportunity.persistenceScore,
                        },
                        { label: "Ráfordítás", value: opportunity.effortScore },
                      ].map((component) => (
                        <div key={component.label}>
                          <dt className="text-2xs text-muted-foreground">
                            {component.label}
                          </dt>
                          <dd className="tabular text-xs font-medium">
                            {component.value}
                          </dd>
                        </div>
                      ))}
                    </dl>

                    <p className="mt-3 text-2xs leading-relaxed text-subtle-foreground">
                      {String(opportunity.assumptions.formula)}
                    </p>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Hogyan számoljuk ezeket az értékeket?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs leading-relaxed text-muted-foreground">
            <p>
              A további konverziók becslése a belépők számának és a konverziós
              arány javulásának szorzata. A többletbevétel ezt szorozza a
              későbbi lépésekben ténylegesen megfigyelt, konverziónkénti
              bevétellel, 30 napra vetítve.
            </p>
            <p>
              A megbízhatóságot a minta mérete és a megfigyelt bevétel határozza
              meg. Ez nem statisztikai konfidenciaintervallum. A becslés a
              javulás értékét mutatja, nem azt ígéri, hogy a javulás elérhető.
            </p>
          </CardContent>
        </Card>
      </PageBody>
    </>
  );
}
