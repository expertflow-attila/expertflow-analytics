import { displayLabel } from "@/lib/labels";
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

export const metadata = { title: "Attribúció" };
export const dynamic = "force-dynamic";

const MODELS: Array<{ key: AttributionModel; label: string; note: string }> = [
  {
    key: "FIRST_TOUCH",
    label: "Első érintés",
    note: "az első kapcsolat kapja a teljes értéket",
  },
  {
    key: "LAST_TOUCH",
    label: "Utolsó érintés",
    note: "az utolsó kapcsolat kapja a teljes értéket",
  },
  { key: "LINEAR", label: "Lineáris", note: "egyenletes elosztás" },
  { key: "U_SHAPED", label: "U alakú", note: "40 / 40 / 20" },
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
            label: "Pozícióalapú",
            note: "egyedi súlyozás",
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
        title="Attribúciós elemzés"
        description={`Mindegyik modell ugyanazt a ${formatCurrency(totalRevenue, ctx.baseCurrency)} bevételt osztja fel a csatornák között. Az eltérések a modellválasztás hatását mutatják.`}
      />

      <PageBody>
        {demo ? <DemoDataBanner /> : null}
        <p className="text-xs text-muted-foreground">
          Beállított modell: {displayLabel(settings.model)} · Időablak:{" "}
          {windowDays} nap · Közvetlen forgalom:{" "}
          {settings.includeDirect ? "beszámítva" : "kizárva"} · Organikus
          forgalom: {settings.includeOrganic ? "beszámítva" : "kizárva"}. A
          bevételt az egyeztetett rendelések adják.
        </p>

        {conversions.length === 0 ? (
          <EmptyState
            title="Még nincs felosztható bevétel"
            description="Az attribúcióhoz azonosított vásárló és legalább egy rögzített érintési pont szükséges. Csatlakoztass fizetési forrást, és azonosítsd a vevőket a pénztárnál."
          />
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Hozzárendelt bevétel modellenként</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <thead>
                    <tr>
                      <Th>Csatorna</Th>
                      {models.map((model) => (
                        <Th key={model.key} className="text-right">
                          {model.label}
                        </Th>
                      ))}
                      <Th className="text-right">Modellek egyezése</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {channels.map((channel) => {
                      const agreement = confidenceByChannel.get(channel);

                      return (
                        <tr key={channel}>
                          <Td>{displayLabel(channel)}</Td>
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
                                {displayLabel(agreement.band)}
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
                <CardTitle>A legnagyobb eltérések a modellek között</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {confidence.slice(0, 4).map((row) => (
                  <div key={displayLabel(row.channel)} className="space-y-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-sm">
                        {displayLabel(row.channel)}
                      </span>
                      <span className="tabular text-xs text-muted-foreground">
                        {(row.disagreement * 100).toFixed(0)}% eltérés
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
                      Az első érintés szerinti érték:{" "}
                      {formatCurrency(
                        row.perModelRevenueMinor.FIRST_TOUCH,
                        ctx.baseCurrency,
                        { compact: true },
                      )}
                      , az utolsó érintés szerinti érték:{" "}
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
                  Az egyezés a csatornához rendelt bevétel modellek közötti
                  normalizált eltérését mutatja. Nem statisztikai
                  konfidenciaintervallum: az alacsony egyezés azt jelenti, hogy
                  a modellválasztás jelentősen módosítja az eredményt.
                </p>
              </CardContent>
            </Card>

            {unattributableOrders > 0 ? (
              <Card>
                <CardContent className="pt-5">
                  <p className="text-sm">
                    {formatNumber(unattributableOrders)}{" "}
                    {unattributableOrders === 1 ? "vásárlás" : "vásárlás"} nem
                    volt hozzárendelhető az időszakban, mert a vásárlót nem
                    sikerült azonosítani.
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Ezek a vásárlások egyik oszlopban sem szerepelnek, ezért az
                    összegek alacsonyabbak a teljes bevételnél. A Mérés állapota
                    oldalon megtalálod a javítási lehetőségeket.
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
