import { DemoDataBanner, PageBody, PageHeader } from "@/components/page";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, EmptyState, Table, Td, Th } from "@/components/ui/primitives";
import {
  attributeByChannel,
  attributionConfidence,
  type AttributionModel,
} from "@/lib/analytics/attribution-core";
import { formatCurrency, formatNumber } from "@/lib/utils";
import {
  isDemoDataset,
  resolveProjectContext,
  resolveRange,
} from "@/server/analytics/context";
import { loadAttributionSettings } from "@/server/analytics/attribution-settings";
import { loadConversions } from "@/server/analytics/queries";

export const metadata = { title: "Attribution" };
export const dynamic = "force-dynamic";

const MODELS: Array<{ key: AttributionModel; label: string; note: string }> = [
  { key: "FIRST_TOUCH", label: "First touch", note: "all credit to discovery" },
  { key: "LAST_TOUCH", label: "Last touch", note: "all credit to the closer" },
  { key: "LINEAR", label: "Linear", note: "split evenly" },
  { key: "U_SHAPED", label: "U-shaped", note: "40 / 40 / 20" },
];

export default async function AttributionPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; window?: string }>;
}) {
  const { range: rangeParam, window: windowParam } = await searchParams;
  const ctx = await resolveProjectContext();
  const { range } = resolveRange(rangeParam);
  const settings = await loadAttributionSettings(ctx);
  const requestedWindow = Number(windowParam);
  const windowDays =
    Number.isInteger(requestedWindow) &&
    requestedWindow >= 1 &&
    requestedWindow <= 365
      ? requestedWindow
      : settings.windowDays;

  const { conversions, unattributableOrders } = await loadConversions(
    ctx,
    range,
    windowDays,
  );
  const demo = await isDemoDataset(ctx);

  const options = {
    ...settings,
    windowDays,
  };

  const models =
    settings.model === "POSITION_BASED"
      ? [
          ...MODELS,
          {
            key: "POSITION_BASED" as const,
            label: "Position-based",
            note: "custom weights",
          },
        ]
      : MODELS;
  const byModel = models.map((model) => ({
    ...model,
    rows: attributeByChannel(conversions, { ...options, model: model.key }),
  }));

  const channels = [
    ...new Set(byModel.flatMap((m) => m.rows.map((r) => r.channel))),
  ];

  const confidence = attributionConfidence(conversions, options);
  const confidenceByChannel = new Map(confidence.map((c) => [c.channel, c]));

  const totalRevenue = conversions.reduce((sum, c) => sum + c.revenueMinor, 0);

  return (
    <>
      <PageHeader
        title="Attribution Lab"
        description={`Every model below distributes the same ${formatCurrency(totalRevenue, ctx.baseCurrency)} across channels. Where they disagree, no single number is the truth.`}
      />

      <PageBody>
        {demo ? <DemoDataBanner /> : null}
        <p className="text-xs text-muted-foreground">
          Configured model: {settings.model} · Window: {windowDays} days ·
          Direct: {settings.includeDirect ? "included" : "excluded"} · Organic:{" "}
          {settings.includeOrganic ? "included" : "excluded"}. Revenue comes
          from reconciled orders.
        </p>

        {conversions.length === 0 ? (
          <EmptyState
            title="No revenue to attribute yet"
            description="Attribution needs purchases that resolve to a person with at least one recorded touchpoint. Connect a payment source and identify buyers at checkout."
          />
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Attributed revenue by model</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <thead>
                    <tr>
                      <Th>Channel</Th>
                      {models.map((model) => (
                        <Th key={model.key} className="text-right">
                          {model.label}
                        </Th>
                      ))}
                      <Th className="text-right">Agreement</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {channels.map((channel) => {
                      const agreement = confidenceByChannel.get(channel);

                      return (
                        <tr key={channel}>
                          <Td>{channel}</Td>
                          {byModel.map((model) => {
                            const row = model.rows.find(
                              (r) => r.channel === channel,
                            );
                            return (
                              <Td key={model.key} numeric>
                                {formatCurrency(
                                  row?.attributedRevenueMinor ?? 0,
                                  ctx.baseCurrency,
                                  { compact: true },
                                )}
                              </Td>
                            );
                          })}
                          <Td numeric>
                            {agreement ? (
                              <Badge
                                tone={
                                  agreement.band === "HIGH"
                                    ? "positive"
                                    : agreement.band === "MEDIUM"
                                      ? "warning"
                                      : "negative"
                                }
                              >
                                {agreement.band}
                              </Badge>
                            ) : (
                              "—"
                            )}
                          </Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Where the models disagree most</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {confidence.slice(0, 4).map((row) => (
                  <div key={row.channel} className="space-y-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-sm">{row.channel}</span>
                      <span className="tabular text-xs text-muted-foreground">
                        {(row.disagreement * 100).toFixed(0)}% spread
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
                      <div
                        className={
                          row.band === "HIGH"
                            ? "h-full rounded-full bg-positive"
                            : row.band === "MEDIUM"
                              ? "h-full rounded-full bg-warning"
                              : "h-full rounded-full bg-negative"
                        }
                        style={{
                          width: `${Math.max(2, row.disagreement * 100)}%`,
                        }}
                      />
                    </div>
                    <p className="text-2xs text-muted-foreground">
                      First touch credits{" "}
                      {formatCurrency(
                        row.perModelRevenueMinor.FIRST_TOUCH,
                        ctx.baseCurrency,
                        { compact: true },
                      )}
                      , last touch credits{" "}
                      {formatCurrency(
                        row.perModelRevenueMinor.LAST_TOUCH,
                        ctx.baseCurrency,
                        { compact: true },
                      )}
                      .
                    </p>
                  </div>
                ))}

                <p className="border-t border-border pt-3 text-2xs leading-relaxed text-subtle-foreground">
                  Attribution Confidence is the normalised spread between models
                  for a channel. It is a transparency signal, not a statistical
                  confidence interval — a low band means the choice of model
                  changes the answer materially.
                </p>
              </CardContent>
            </Card>

            {unattributableOrders > 0 ? (
              <Card>
                <CardContent className="pt-5">
                  <p className="text-sm">
                    {formatNumber(unattributableOrders)}{" "}
                    {unattributableOrders === 1 ? "purchase" : "purchases"} in
                    this period could not be attributed at all, because no
                    person could be resolved for them.
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Those purchases are excluded from every column above, so the
                    totals here are lower than reported revenue. Tracking Health
                    explains how to close the gap.
                  </p>
                </CardContent>
              </Card>
            ) : null}
          </>
        )}
      </PageBody>
    </>
  );
}
