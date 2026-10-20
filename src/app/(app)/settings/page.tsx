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

export const metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

const RETENTION_LABELS: Record<string, string> = {
  DAYS_30: "30 days",
  DAYS_90: "90 days",
  DAYS_180: "180 days",
  DAYS_365: "365 days",
  UNLIMITED: "Unlimited",
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
    { label: "Organization", value: organization.name },
    {
      label: "Timezone",
      value: organization.timezone,
      note: "All day bucketing uses this, never the viewer's browser.",
    },
    { label: "Project", value: project.name },
    {
      label: "Base currency",
      value: project.baseCurrency,
      note: "Events in another currency are flagged, never silently converted.",
    },
    {
      label: "Data retention",
      value: RETENTION_LABELS[project.dataRetention] ?? project.dataRetention,
    },
    { label: "Your role", value: ctx.role },
  ];

  return (
    <>
      <PageHeader
        title="Settings"
        description="Configuration that changes how every number in this product is calculated."
      />

      <PageBody>
        {ctx.role === "OWNER" || ctx.role === "ADMIN" ? (
          <Card>
            <CardHeader>
              <CardTitle>Edit workspace</CardTitle>
            </CardHeader>
            <CardContent>
              <ConfigForm action={saveWorkspace} submitLabel="Save workspace">
                <input type="hidden" name="projectId" value={ctx.projectId} />
                <Label htmlFor="organizationName">Organization name</Label>
                <Input
                  id="organizationName"
                  name="organizationName"
                  defaultValue={organization.name}
                  required
                  minLength={2}
                />
                <Label htmlFor="projectName">Project name</Label>
                <Input
                  id="projectName"
                  name="projectName"
                  defaultValue={project.name}
                  required
                  minLength={2}
                />
                <Label htmlFor="timezone">Timezone</Label>
                <Input
                  id="timezone"
                  name="timezone"
                  defaultValue={organization.timezone}
                  required
                />
                <Label htmlFor="baseCurrency">Base currency (fixed)</Label>
                <Input
                  id="baseCurrency"
                  name="baseCurrency"
                  value={project.baseCurrency}
                  readOnly
                />
                <p className="text-xs text-muted-foreground">
                  A different currency needs a separate project so historical
                  amounts keep their meaning.
                </p>
              </ConfigForm>
            </CardContent>
          </Card>
        ) : null}
        {(ctx.role === "OWNER" || ctx.role === "ADMIN") && attribution ? (
          <Card>
            <CardHeader>
              <CardTitle>Edit attribution</CardTitle>
            </CardHeader>
            <CardContent>
              <ConfigForm
                action={saveAttribution}
                submitLabel="Save attribution"
              >
                <input type="hidden" name="projectId" value={ctx.projectId} />
                <Label htmlFor="model">Model</Label>
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
                    <option key={m}>{m}</option>
                  ))}
                </select>
                <Label htmlFor="windowDays">Attribution window (days)</Label>
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
                  Revenue event (reconciled orders)
                </Label>
                <Input
                  id="revenueEventName"
                  name="revenueEventName"
                  value={attribution.revenueEventName}
                  readOnly
                />
                <Label htmlFor="firstTouchWeight">
                  First touch weight (position-based model)
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
                  Lead touch weight (position-based model)
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
                  Include direct and unknown
                </label>
                <label className="block text-sm">
                  <input
                    name="includeOrganic"
                    type="checkbox"
                    defaultChecked={attribution.includeOrganic === "true"}
                  />{" "}
                  Include organic
                </label>
              </ConfigForm>
            </CardContent>
          </Card>
        ) : null}
        <Card>
          <CardHeader>
            <CardTitle>Workspace</CardTitle>
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
              <CardTitle>Attribution</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-2">
                {[
                  { label: "Model", value: attribution.model },
                  { label: "Window", value: `${attribution.windowDays} days` },
                  {
                    label: "Revenue event",
                    value: attribution.revenueEventName,
                  },
                  {
                    label: "Include direct and unknown",
                    value: attribution.includeDirect === "true" ? "Yes" : "No",
                  },
                  {
                    label: "Include organic",
                    value: attribution.includeOrganic === "true" ? "Yes" : "No",
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
            <CardTitle>Data source</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge
                tone={project.settings?.demoDataset ? "warning" : "positive"}
              >
                {project.settings?.demoDataset ? "Demo dataset" : "Live data"}
              </Badge>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {project.settings?.demoDataset
                ? "This project holds generated sample data. Every analytics screen labels it as such. The flag is cleared deliberately, not automatically, so real and sample data can never be confused."
                : "This project reports measured data only."}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Feature flags</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2">
              {Object.entries(features).map(([key, enabled]) => (
                <div
                  key={key}
                  className="flex items-baseline justify-between gap-4"
                >
                  <dt className="text-xs text-muted-foreground">{key}</dt>
                  <dd>
                    <Badge tone={enabled ? "positive" : "neutral"}>
                      {enabled ? "on" : "off"}
                    </Badge>
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-2xs text-subtle-foreground">
              Set through environment variables; see .env.example.
            </p>
          </CardContent>
        </Card>
      </PageBody>
    </>
  );
}
