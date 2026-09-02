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
import { calculateTrackingHealth, detectAnomalies } from "@/lib/analytics/anomaly-core";
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

export const metadata = { title: "Overview" };
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
      ? { name: channels[0].channel, revenueMinor: channels[0].attributedRevenueMinor }
      : null,
    biggestOpportunity: opportunities[0] ?? null,
    trackingHealthScore: trackingHealth.score,
  });

  const revenueAnomalies = detectAnomalies("revenue", series.revenue).slice(-3);
  const leadAnomalies = detectAnomalies("leads", series.leads).slice(-3);
  const changes = [...revenueAnomalies, ...leadAnomalies]
    .sort((a, b) => Math.abs(b.changeFraction) - Math.abs(a.changeFraction))
    .slice(0, 4);

  const delta = (currentValue: number, previousValue: number) => {
    if (previousValue === 0) return { label: "—", value: null };
    const change = (currentValue - previousValue) / previousValue;
    return {
      label: `${change > 0 ? "+" : ""}${(change * 100).toFixed(1)}%`,
      value: change,
    };
  };

  return (
    <>
      <PageHeader
        title="Overview"
        description={`${periodDays} days to today, in ${ctx.timezone}.`}
        actions={
          <DataQualityBadge
            score={trackingHealth.score}
            detail="Derived from duplicate rate, source coverage and purchase reconciliation."
          />
        }
      />

      <PageBody>
        {demo ? <DemoDataBanner /> : null}

        <Card>
          <CardHeader>
            <CardTitle>Executive summary</CardTitle>
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
            label="Net revenue"
            value={formatCurrency(current.netRevenueMinor, ctx.baseCurrency, {
              compact: true,
            })}
            delta={delta(current.netRevenueMinor, prior.netRevenueMinor)}
            hint="after refunds"
          />
          <StatTile
            label="Customers"
            value={formatNumber(current.customers)}
            delta={delta(current.customers, prior.customers)}
          />
          <StatTile
            label="Leads"
            value={formatNumber(current.leads, { compact: true })}
            delta={delta(current.leads, prior.leads)}
          />
          <StatTile
            label="Visitors"
            value={formatNumber(current.visitors, { compact: true })}
            delta={delta(current.visitors, prior.visitors)}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="Funnel conversion"
            value={formatPercent(funnelData?.result.overallConversionRate ?? null)}
            hint="visitor to customer"
          />
          <StatTile
            label="Average order value"
            value={formatCurrency(
              current.averageOrderValueMinor,
              ctx.baseCurrency,
            )}
          />
          <StatTile
            label="Revenue per visitor"
            value={formatCurrency(
              current.revenuePerVisitorMinor,
              ctx.baseCurrency,
            )}
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
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Biggest opportunity</CardTitle>
              <Link
                href="/opportunities"
                className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
              >
                All opportunities <ArrowRight className="size-3" aria-hidden />
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
                      {formatPercent(opportunities[0].currentConversionRate)} today
                      against a {formatPercent(opportunities[0].targetConversionRate)}{" "}
                      target, across{" "}
                      {formatNumber(opportunities[0].eligibleUsers)} people.
                    </p>
                  </div>

                  <p className="tabular text-2xl font-semibold tracking-tight">
                    {formatCurrency(
                      opportunities[0].estimatedMonthlyUpsideMinor,
                      ctx.baseCurrency,
                      { compact: true },
                    )}
                    <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                      estimated monthly upside
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
                      {opportunities[0].confidence} confidence
                    </Badge>
                  </div>

                  <p className="text-2xs leading-relaxed text-subtle-foreground">
                    {opportunities[0].confidenceReason} This is an estimate from
                    observed downstream revenue, not a forecast.
                  </p>
                </div>
              ) : (
                <EmptyState
                  title="No opportunity can be estimated yet"
                  description="Opportunities need a funnel with conversion targets and observed downstream revenue."
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>What changed</CardTitle>
            </CardHeader>
            <CardContent>
              {changes.length > 0 ? (
                <ul className="space-y-3">
                  {changes.map((anomaly) => (
                    <li
                      key={`${anomaly.metric}-${anomaly.date}`}
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
                            {anomaly.metric}
                          </span>{" "}
                          {anomaly.direction === "SPIKE" ? "rose" : "fell"}{" "}
                          {Math.abs(anomaly.changeFraction * 100).toFixed(0)}% on{" "}
                          {anomaly.date}
                        </p>
                        <p className="text-2xs text-muted-foreground">
                          Expected around {formatNumber(anomaly.expected)}, observed{" "}
                          {formatNumber(anomaly.observed)} ({anomaly.deviationSigma}σ)
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  title="Nothing unusual in this period"
                  description="Anomaly detection compares each day against a rolling baseline of the same weekday. It stays quiet until a move is both large and statistically unusual."
                />
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Attributed revenue by channel</CardTitle>
            <Link
              href="/attribution"
              className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
            >
              Attribution lab <ArrowRight className="size-3" aria-hidden />
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
                    <li key={channel.channel} className="space-y-1">
                      <div className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="truncate">{channel.channel}</span>
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
                title="No revenue has been attributed yet"
                description="Attribution needs purchases that resolve to a person with at least one recorded touchpoint."
              />
            )}
            <p className="mt-4 text-2xs text-subtle-foreground">
              Credited with the U-shaped model over a 90 day window. Different
              models will disagree — the Attribution Lab shows by how much.
            </p>
          </CardContent>
        </Card>
      </PageBody>
    </>
  );
}
