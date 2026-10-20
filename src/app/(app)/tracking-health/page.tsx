import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";

import { DemoDataBanner, PageBody, PageHeader } from "@/components/page";
import { Card, CardContent } from "@/components/ui/card";
import { calculateTrackingHealth } from "@/lib/analytics/anomaly-core";
import { cn } from "@/lib/utils";
import {
  isDemoDataset,
  resolveProjectContext,
  resolveRange,
} from "@/server/analytics/context";
import { loadTrackingHealthInput } from "@/server/analytics/queries";

export const metadata = { title: "Mérés állapota" };
export const dynamic = "force-dynamic";

const ICONS = {
  PASS: CheckCircle2,
  WARN: AlertTriangle,
  FAIL: XCircle,
} as const;

const TONES = {
  PASS: "text-positive",
  WARN: "text-warning",
  FAIL: "text-negative",
} as const;

export default async function TrackingHealthPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { range: rangeParam } = await searchParams;
  const ctx = await resolveProjectContext();
  const { range } = resolveRange(rangeParam);

  const input = await loadTrackingHealthInput(ctx, range);
  const { score, unavailableReason, checks } = calculateTrackingHealth(input);
  const demo = await isDemoDataset(ctx);

  const failing = checks.filter((c) => c.status !== "PASS");

  return (
    <>
      <PageHeader
        title="Mérés állapota"
        description="Mennyire megbízhatók az elemzések? Minden ellenőrzés megmutatja a vizsgált adatokat és a szükséges javítást."
      />

      <PageBody>
        {demo ? <DemoDataBanner /> : null}

        <Card>
          <CardContent className="pt-6">
            {score === null ? (
              <div className="space-y-2">
                <p className="text-2xl font-semibold tracking-tight text-muted-foreground">
                  Nem elérhető
                </p>
                <p className="max-w-lg text-xs leading-relaxed text-muted-foreground">
                  {unavailableReason} Telepítsd a mérőkódot, vagy küldj egy
                  eseményt az API-ra az ellenőrzések elindításához.
                </p>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-baseline gap-4">
                  <p
                    className={cn(
                      "tabular text-4xl font-semibold tracking-tight",
                      score >= 85
                        ? "text-positive"
                        : score >= 60
                          ? "text-warning"
                          : "text-negative",
                    )}
                  >
                    {score}
                    <span className="ml-1 text-base font-normal text-muted-foreground">
                      / 100
                    </span>
                  </p>

                  <p className="max-w-md text-xs leading-relaxed text-muted-foreground">
                    {failing.length === 0
                      ? "Minden ellenőrzés sikeres. Az elemzési oldalak adatai megbízhatók."
                      : `${failing.length} ellenőrzés igényel figyelmet. A csatornák és az attribúció értékeit a javításig kezeld tájékoztató jellegűként.`}
                  </p>
                </div>

                <div
                  className="mt-5 h-2 w-full overflow-hidden rounded-full bg-surface-muted"
                  role="img"
                  aria-label={`Mérési pontszám: ${score} a 100-ból`}
                >
                  <div
                    className={cn(
                      "h-full rounded-full",
                      score >= 85
                        ? "bg-positive"
                        : score >= 60
                          ? "bg-warning"
                          : "bg-negative",
                    )}
                    style={{ width: `${score}%` }}
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <ul className="space-y-2.5">
          {checks.map((check) => {
            const Icon = ICONS[check.status];

            return (
              <li key={check.key}>
                <Card>
                  <CardContent className="flex items-start gap-3 pt-4">
                    <Icon
                      className={cn(
                        "mt-0.5 size-4 shrink-0",
                        TONES[check.status],
                      )}
                      aria-hidden
                    />

                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="text-sm font-medium">{check.label}</p>
                        <span className="text-2xs text-subtle-foreground">
                          súly: {check.weight} pont
                        </span>
                      </div>

                      <p className="text-xs text-muted-foreground">
                        {check.detail}
                      </p>

                      {check.status !== "PASS" ? (
                        <p className="text-xs leading-relaxed">
                          <span className="font-medium">
                            Javasolt javítás:{" "}
                          </span>
                          {check.recommendation}
                        </p>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>

        <Card>
          <CardContent className="pt-5">
            <p className="text-2xs font-medium tracking-wide text-muted-foreground uppercase">
              Az ellenőrzések alapadatai
            </p>
            <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
              {[
                { label: "Események", value: input.totalEvents },
                { label: "Munkamenetek", value: input.totalSessions },
                { label: "Vásárlások", value: input.totalPurchases },
                { label: "Adatfogadási kérések", value: input.ingestRequests },
                { label: "Duplikációk", value: input.duplicateEvents },
                {
                  label: "Anonim események",
                  value: input.eventsWithoutIdentity,
                },
                {
                  label: "Ismeretlen forrású munkamenetek",
                  value: input.sessionsWithUnknownSource,
                },
                {
                  label: "Nem egyeztetett vásárlások",
                  value: input.purchasesWithoutPerson,
                },
              ].map((row) => (
                <div key={row.label}>
                  <dt className="text-2xs text-muted-foreground">
                    {row.label}
                  </dt>
                  <dd className="tabular text-sm font-medium">
                    {row.value.toLocaleString("hu-HU")}
                  </dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      </PageBody>
    </>
  );
}
