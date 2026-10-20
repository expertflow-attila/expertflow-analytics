import { formatDate, formatRelativeChange } from "@/lib/utils";
import { displayLabel } from "@/lib/labels";
import { ArrowRight, TrendingDown, TrendingUp } from "lucide-react";
import Link from "next/link";

import {
  DataQualityBadge,
  DemoDataBanner,
  PageBody,
  PageHeader,
  StatTile,
} from "@/components/page";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, EmptyState } from "@/components/ui/primitives";
import {
  calculateTrackingHealth,
  detectAnomalies,
} from "@/lib/analytics/anomaly-core";
import { attributeByChannel } from "@/lib/analytics/attribution-core";
import { rankOpportunities } from "@/lib/analytics/opportunity-core";
import { buildExecutiveSummary } from "@/lib/analytics/summary";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils";
import {
  isDemoDataset,
  resolveProjectContext,
  resolveRange,
} from "@/server/analytics/context";
import {
  loadConversions,
  loadDailySeries,
  loadFunnel,
  loadOverview,
  loadTrackingHealthInput,
  previousRange,
  rangeDays,
} from "@/server/analytics/queries";
import { db } from "@/server/db";
import { funnels } from "@/server/db/schema";
import { eq } from "drizzle-orm";

export const metadata = { title: "Áttekintés" };
export const dynamic = "force-dynamic";

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { range: rangeParam } = await searchParams;
  const ctx = await resolveProjectContext();
  const { range } = resolveRange(rangeParam);
  const previous = previousRange(range);

  const [current, prior, health, series, demo] = await Promise.all([
    loadOverview(ctx, range),
    loadOverview(ctx, previous),
    loadTrackingHealthInput(ctx, range),
    loadDailySeries(ctx, range),
    isDemoDataset(ctx),
  ]);

  const trackingHealth = calculateTrackingHealth(health);

  const [funnel] = await db
    .select({ id: funnels.id })
    .from(funnels)
    .where(eq(funnels.projectId, ctx.projectId))
    .limit(1);

  const funnelData = funnel ? await loadFunnel(ctx, funnel.id, range) : null;
  const periodDays = rangeDays(range);

  const opportunities = funnelData
    ? rankOpportunities(
        funnelData.result.nodes
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
        { kind: "TARGET" },
      )
    : [];

  const { conversions } = await loadConversions(ctx, range, 90);
  const channels = attributeByChannel(conversions, {
    model: "U_SHAPED",
    windowDays: 90,
    includeDirect: true,
    includeOrganic: true,
  });

  const summary = buildExecutiveSummary({
    currency: ctx.baseCurrency,
    netRevenueMinor: current.netRevenueMinor,
    previousNetRevenueMinor: prior.netRevenueMinor,
    topChannel: channels[0]
      ? {
          name: channels[0].channel,
          revenueMinor: channels[0].attributedRevenueMinor,
        }
      : null,
    biggestOpportunity: opportunities[0] ?? null,
    trackingHealthScore: trackingHealth.score,
  });

  const revenueAnomalies = detectAnomalies("revenue", series.revenue).slice(-3);
  const leadAnomalies = detectAnomalies("leads", series.leads).slice(-3);
  const changes = [...revenueAnomalies, ...leadAnomalies]
    .sort((a, b) => Math.abs(b.changeFraction) - Math.abs(a.changeFraction))
    .slice(0, 4);

  const delta = formatRelativeChange;

  return (
    <>
      <PageHeader
        title="Áttekintés"
        description={`Az elmúlt ${periodDays} nap adatai · ${ctx.timezone}`}
        actions={
          <DataQualityBadge
            score={trackingHealth.score}
            detail="A duplikált események, a forrásazonosítás és a vásárlásegyeztetés alapján."
          />
        }
      />

      <PageBody>
        {demo ? <DemoDataBanner /> : null}

        <Card>
          <CardHeader>
            <CardTitle>Vezetői összefoglaló</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {summary.map((sentence) => (
              <p key={sentence} className="text-sm leading-relaxed">
                {sentence}
              </p>
            ))}
          </CardContent>
        </Card>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="Nettó bevétel"
            value={formatCurrency(current.netRevenueMinor, ctx.baseCurrency, {
              compact: true,
            })}
            delta={delta(current.netRevenueMinor, prior.netRevenueMinor)}
            hint="visszatérítések után"
          />
          <StatTile
            label="Ügyfelek"
            value={formatNumber(current.customers)}
            delta={delta(current.customers, prior.customers)}
          />
          <StatTile
            label="Érdeklődők"
            value={formatNumber(current.leads, { compact: true })}
            delta={delta(current.leads, prior.leads)}
          />
          <StatTile
            label="Látogatók"
            value={formatNumber(current.visitors, { compact: true })}
            delta={delta(current.visitors, prior.visitors)}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="Tölcsérkonverzió"
            value={formatPercent(
              funnelData?.result.overallConversionRate ?? null,
            )}
            hint="látogatóból vásárló"
          />
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
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Legnagyobb lehetőség</CardTitle>
              <Link
                href="/opportunities"
                className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
              >
                Összes lehetőség <ArrowRight className="size-3" aria-hidden />
              </Link>
            </CardHeader>
            <CardContent>
              {opportunities[0] ? (
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium">
                      {opportunities[0].nodeName}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatPercent(opportunities[0].currentConversionRate)}{" "}
                      jelenlegi arány; cél:{" "}
                      {formatPercent(opportunities[0].targetConversionRate)} ,
                      érintett: {formatNumber(opportunities[0].eligibleUsers)}{" "}
                      fő.
                    </p>
                  </div>

                  <p className="tabular text-2xl font-semibold tracking-tight">
                    {formatCurrency(
                      opportunities[0].estimatedMonthlyUpsideMinor,
                      ctx.baseCurrency,
                      { compact: true },
                    )}
                    <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                      becsült havi többletbevétel
                    </span>
                  </p>

                  <div className="flex items-center gap-2">
                    <Badge
                      tone={
                        opportunities[0].confidence === "HIGH"
                          ? "positive"
                          : opportunities[0].confidence === "MEDIUM"
                            ? "warning"
                            : "neutral"
                      }
                    >
                      {displayLabel(opportunities[0].confidence)} megbízhatóság
                    </Badge>
                  </div>

                  <p className="text-2xs leading-relaxed text-subtle-foreground">
                    {opportunities[0].confidenceReason} A becslés a későbbi
                    lépésekben megfigyelt bevételen alapul, nem előrejelzés.
                  </p>
                </div>
              ) : (
                <EmptyState
                  title="Még nem becsülhető bevételi lehetőség"
                  description="A lehetőségek becsléséhez konverziós célokkal rendelkező tölcsér és megfigyelt bevétel szükséges."
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Mi változott?</CardTitle>
            </CardHeader>
            <CardContent>
              {changes.length > 0 ? (
                <ul className="space-y-3">
                  {changes.map((anomaly) => (
                    <li
                      key={`${displayLabel(anomaly.metric)}-${formatDate(anomaly.date, ctx.timezone)}`}
                      className="flex items-start gap-2.5"
                    >
                      {anomaly.direction === "SPIKE" ? (
                        <TrendingUp
                          className="mt-0.5 size-4 shrink-0 text-positive"
                          aria-hidden
                        />
                      ) : (
                        <TrendingDown
                          className="mt-0.5 size-4 shrink-0 text-negative"
                          aria-hidden
                        />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm">
                          <span className="font-medium capitalize">
                            {displayLabel(anomaly.metric)}
                          </span>{" "}
                          {anomaly.direction === "SPIKE"
                            ? "növekedett"
                            : "csökkent"}{" "}
                          {Math.abs(anomaly.changeFraction * 100).toFixed(0)}%
                          mértékben ezen a napon: {formatDate(anomaly.date, ctx.timezone)}
                        </p>
                        <p className="text-2xs text-muted-foreground">
                          Várt érték: {formatNumber(anomaly.expected)},
                          tényleges: {formatNumber(anomaly.observed)} (
                          {anomaly.deviationSigma}σ)
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  title="Nincs szokatlan változás az időszakban"
                  description="Minden napot az azonos hétköznapok gördülő átlagával vetünk össze. Csak a nagy és statisztikailag szokatlan eltéréseket jelezzük."
                />
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Csatornához rendelt bevétel</CardTitle>
            <Link
              href="/attribution"
              className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
            >
              Attribúciós elemzés <ArrowRight className="size-3" aria-hidden />
            </Link>
          </CardHeader>
          <CardContent>
            {channels.length > 0 ? (
              <ul className="space-y-2.5">
                {channels.slice(0, 6).map((channel) => {
                  const share =
                    channels[0].attributedRevenueMinor === 0
                      ? 0
                      : channel.attributedRevenueMinor /
                        channels[0].attributedRevenueMinor;

                  return (
                    <li
                      key={displayLabel(channel.channel)}
                      className="space-y-1"
                    >
                      <div className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="truncate">
                          {displayLabel(channel.channel)}
                        </span>
                        <span className="tabular shrink-0 font-medium">
                          {formatCurrency(
                            channel.attributedRevenueMinor,
                            ctx.baseCurrency,
                            { compact: true },
                          )}
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
                        <div
                          className="h-full rounded-full bg-series-1"
                          style={{ width: `${Math.max(2, share * 100)}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState
                title="Még nincs csatornához rendelt bevétel"
                description="Az attribúcióhoz azonosított vásárló és legalább egy rögzített érintési pont szükséges."
              />
            )}
            <p className="mt-4 text-2xs text-subtle-foreground">
              U alakú modell, 90 napos időablakkal. A modellek eltérő eredményt
              adhatnak; az Attribúciós elemzés megmutatja az eltérés mértékét.
            </p>
          </CardContent>
        </Card>
      </PageBody>
    </>
  );
}
