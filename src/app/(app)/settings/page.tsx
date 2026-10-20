import { displayLabel } from "@/lib/labels";
import { eq } from "drizzle-orm";

import { PageBody, PageHeader } from "@/components/page";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/primitives";
import { ConfigForm } from "@/components/config-form";
import { saveWorkspace, saveAttribution } from "@/server/actions/configuration";
import { Input, Label } from "@/components/ui/primitives";
import { features } from "@/env";
import { resolveProjectContext } from "@/server/analytics/context";
import { db } from "@/server/db";
import {
  attributionConfigs,
  organizations,
  projects,
} from "@/server/db/schema";

export const metadata = { title: "Beállítások" };
export const dynamic = "force-dynamic";

const RETENTION_LABELS: Record<string, string> = {
  DAYS_30: "30 nap",
  DAYS_90: "90 nap",
  DAYS_180: "180 nap",
  DAYS_365: "365 nap",
  UNLIMITED: "Korlátlan",
};

export default async function SettingsPage() {
  const ctx = await resolveProjectContext();

  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, ctx.projectId))
    .limit(1);

  const [organization] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, ctx.organizationId))
    .limit(1);

  const [attribution] = await db
    .select()
    .from(attributionConfigs)
    .where(eq(attributionConfigs.projectId, ctx.projectId))
    .limit(1);

  const rows: Array<{ label: string; value: string; note?: string }> = [
    { label: "Szervezet", value: organization.name },
    {
      label: "Időzóna",
      value: organization.timezone,
      note: "A napi összesítések ezt használják, nem a megtekintő böngészőjének időzónáját.",
    },
    { label: "Projekt", value: project.name },
    {
      label: "Alappénznem",
      value: project.baseCurrency,
      note: "Az eltérő pénznemű eseményeket jelezzük, automatikus átváltás nélkül.",
    },
    {
      label: "Adatmegőrzés",
      value: RETENTION_LABELS[project.dataRetention] ?? project.dataRetention,
    },
    { label: "Jogosultságod", value: displayLabel(ctx.role) },
  ];

  return (
    <>
      <PageHeader
        title="Beállítások"
        description="A mutatók számítását meghatározó beállítások."
      />

      <PageBody>
        {ctx.role === "OWNER" || ctx.role === "ADMIN" ? (
          <Card>
            <CardHeader>
              <CardTitle>Munkaterület szerkesztése</CardTitle>
            </CardHeader>
            <CardContent>
              <ConfigForm
                action={saveWorkspace}
                submitLabel="Munkaterület mentése"
              >
                <input type="hidden" name="projectId" value={ctx.projectId} />
                <Label htmlFor="organizationName">Szervezet neve</Label>
                <Input
                  id="organizationName"
                  name="organizationName"
                  defaultValue={organization.name}
                  required
                  minLength={2}
                />
                <Label htmlFor="projectName">Projekt neve</Label>
                <Input
                  id="projectName"
                  name="projectName"
                  defaultValue={project.name}
                  required
                  minLength={2}
                />
                <Label htmlFor="timezone">Időzóna</Label>
                <Input
                  id="timezone"
                  name="timezone"
                  defaultValue={organization.timezone}
                  required
                />
                <Label htmlFor="baseCurrency">Alappénznem (rögzített)</Label>
                <Input
                  id="baseCurrency"
                  name="baseCurrency"
                  value={project.baseCurrency}
                  readOnly
                />
                <p className="text-xs text-muted-foreground">
                  Más pénznemhez külön projekt szükséges, hogy a korábbi
                  összegek jelentése megmaradjon.
                </p>
              </ConfigForm>
            </CardContent>
          </Card>
        ) : null}
        {(ctx.role === "OWNER" || ctx.role === "ADMIN") && attribution ? (
          <Card>
            <CardHeader>
              <CardTitle>Attribúció szerkesztése</CardTitle>
            </CardHeader>
            <CardContent>
              <ConfigForm
                action={saveAttribution}
                submitLabel="Attribúció mentése"
              >
                <input type="hidden" name="projectId" value={ctx.projectId} />
                <Label htmlFor="model">Modell</Label>
                <select
                  id="model"
                  name="model"
                  defaultValue={attribution.model}
                  className="block rounded-md border bg-surface p-2"
                >
                  {[
                    "FIRST_TOUCH",
                    "LAST_TOUCH",
                    "LINEAR",
                    "U_SHAPED",
                    "POSITION_BASED",
                  ].map((m) => (
                    <option key={m} value={m}>
                      {displayLabel(m)}
                    </option>
                  ))}
                </select>
                <Label htmlFor="windowDays">Attribúciós időablak (nap)</Label>
                <Input
                  id="windowDays"
                  name="windowDays"
                  type="number"
                  min={1}
                  max={365}
                  defaultValue={attribution.windowDays}
                  required
                />
                <Label htmlFor="revenueEventName">
                  Bevételi esemény (egyeztetett rendelések)
                </Label>
                <Input
                  id="revenueEventName"
                  name="revenueEventName"
                  value={attribution.revenueEventName}
                  readOnly
                />
                <Label htmlFor="firstTouchWeight">
                  Első érintés súlya (pozícióalapú modell)
                </Label>
                <Input
                  id="firstTouchWeight"
                  name="firstTouchWeight"
                  type="number"
                  min={0}
                  max={1}
                  step="0.01"
                  defaultValue={attribution.firstTouchWeight}
                  required
                />
                <Label htmlFor="leadTouchWeight">
                  Érdeklődővé válás súlya (pozícióalapú modell)
                </Label>
                <Input
                  id="leadTouchWeight"
                  name="leadTouchWeight"
                  type="number"
                  min={0}
                  max={1}
                  step="0.01"
                  defaultValue={attribution.leadTouchWeight}
                  required
                />
                <label className="block text-sm">
                  <input
                    name="includeDirect"
                    type="checkbox"
                    defaultChecked={attribution.includeDirect === "true"}
                  />{" "}
                  Közvetlen és ismeretlen forgalom beszámítása
                </label>
                <label className="block text-sm">
                  <input
                    name="includeOrganic"
                    type="checkbox"
                    defaultChecked={attribution.includeOrganic === "true"}
                  />{" "}
                  Organikus forgalom beszámítása
                </label>
              </ConfigForm>
            </CardContent>
          </Card>
        ) : null}
        <Card>
          <CardHeader>
            <CardTitle>Munkaterület</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3">
              {rows.map((row) => (
                <div key={row.label} className="space-y-0.5">
                  <div className="flex items-baseline justify-between gap-4">
                    <dt className="text-xs text-muted-foreground">
                      {row.label}
                    </dt>
                    <dd className="text-xs font-medium">{row.value}</dd>
                  </div>
                  {row.note ? (
                    <p className="text-2xs text-subtle-foreground">
                      {row.note}
                    </p>
                  ) : null}
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        {attribution ? (
          <Card>
            <CardHeader>
              <CardTitle>Attribúció</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-2">
                {[
                  { label: "Modell", value: displayLabel(attribution.model) },
                  { label: "Időablak", value: `${attribution.windowDays} nap` },
                  {
                    label: "Bevételi esemény",
                    value: attribution.revenueEventName,
                  },
                  {
                    label: "Közvetlen és ismeretlen forgalom beszámítása",
                    value:
                      attribution.includeDirect === "true" ? "Igen" : "Nem",
                  },
                  {
                    label: "Organikus forgalom beszámítása",
                    value:
                      attribution.includeOrganic === "true" ? "Igen" : "Nem",
                  },
                ].map((row) => (
                  <div
                    key={row.label}
                    className="flex items-baseline justify-between gap-4"
                  >
                    <dt className="text-xs text-muted-foreground">
                      {row.label}
                    </dt>
                    <dd className="text-xs font-medium">{row.value}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Adatforrás</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge
                tone={project.settings?.demoDataset ? "warning" : "positive"}
              >
                {project.settings?.demoDataset ? "Demóadatok" : "Éles adatok"}
              </Badge>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {project.settings?.demoDataset
                ? "Ez a projekt generált mintaadatokat tartalmaz, amit minden elemzési oldal jelez. A demójelölés csak kifejezett művelettel szűnik meg, hogy a mintaadatok és az éles mérések elkülönüljenek."
                : "Ez a projekt kizárólag mért adatokat mutat."}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Elérhető funkciók</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2">
              {Object.entries(features).map(([key, enabled]) => (
                <div
                  key={key}
                  className="flex items-baseline justify-between gap-4"
                >
                  <dt className="text-xs text-muted-foreground">
                    {displayLabel(key)}
                  </dt>
                  <dd>
                    <Badge tone={enabled ? "positive" : "neutral"}>
                      {enabled ? "bekapcsolva" : "kikapcsolva"}
                    </Badge>
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-2xs text-subtle-foreground">
              A funkciókat az üzemeltető állítja be a környezeti változókkal.
            </p>
          </CardContent>
        </Card>
      </PageBody>
    </>
  );
}
