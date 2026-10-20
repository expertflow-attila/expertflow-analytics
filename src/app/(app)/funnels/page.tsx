import { asc, eq } from "drizzle-orm";
import Link from "next/link";

import { DemoDataBanner, PageBody, PageHeader } from "@/components/page";
import { FunnelEditor } from "@/components/funnel-editor";
import { FunnelCanvas, type CanvasNode } from "@/components/funnel-canvas";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, EmptyState, Table, Td, Th } from "@/components/ui/primitives";
import { calculateEdges } from "@/lib/analytics/funnel-core";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils";
import {
  isDemoDataset,
  resolveProjectContext,
  resolveRange,
} from "@/server/analytics/context";
import { loadFunnel, loadObservedPaths } from "@/server/analytics/queries";
import { db } from "@/server/db";
import { funnelNodes, funnels } from "@/server/db/schema";
import { features } from "@/env";

export const metadata = { title: "Funnels" };
export const dynamic = "force-dynamic";

export default async function FunnelsPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; range?: string }>;
}) {
  const { id, range: rangeParam } = await searchParams;
  const ctx = await resolveProjectContext();
  const canEdit = ctx.role === "OWNER" || ctx.role === "ADMIN";
  const { range } = resolveRange(rangeParam);

  const available = await db
    .select({ id: funnels.id, name: funnels.name })
    .from(funnels)
    .where(eq(funnels.projectId, ctx.projectId))
    .orderBy(asc(funnels.createdAt));

  if (available.length === 0) {
    return (
      <>
        <PageHeader title="Funnels" />
        <PageBody>
          {canEdit ? <FunnelEditor projectId={ctx.projectId} /> : null}
          <EmptyState
            title="No funnel has been built yet"
            description="A funnel is an ordered set of steps, each matching one event. Build one to see conversion, drop-off and the revenue behind each step."
          />
        </PageBody>
      </>
    );
  }

  const selectedId = id ?? available[0].id;
  const data = await loadFunnel(ctx, selectedId, range);

  if (!data) {
    return (
      <>
        <PageHeader title="Funnels" />
        <PageBody>
          <EmptyState
            title="That funnel could not be found"
            description="It may have been deleted, or it belongs to a different project."
          />
        </PageBody>
      </>
    );
  }

  const nodeRows = await db
    .select({
      id: funnelNodes.id,
      kind: funnelNodes.kind,
      name: funnelNodes.name,
      matchRule: funnelNodes.matchRule,
      targetConversionRate: funnelNodes.targetConversionRate,
      stepIndex: funnelNodes.stepIndex,
      positionX: funnelNodes.positionX,
      positionY: funnelNodes.positionY,
    })
    .from(funnelNodes)
    .where(eq(funnelNodes.funnelId, selectedId));

  const positions = new Map(nodeRows.map((row) => [row.id, row]));

  // The biggest leak is the step losing the most downstream revenue against
  // its own target — not simply the lowest conversion rate, which would always
  // flag the hardest step in any funnel.
  let biggestLeakId: string | null = null;
  let worstLoss = 0;
  for (const node of data.result.nodes) {
    if (
      node.varianceToTargetPoints === null ||
      node.varianceToTargetPoints >= 0
    ) {
      continue;
    }
    const perConversion =
      node.converted === 0 ? 0 : node.downstreamRevenueMinor / node.converted;
    const loss = node.entered * -node.varianceToTargetPoints * perConversion;
    if (loss > worstLoss) {
      worstLoss = loss;
      biggestLeakId = node.nodeId;
    }
  }

  const canvasNodes: CanvasNode[] = data.result.nodes.map((node, index) => ({
    ...node,
    kind: positions.get(node.nodeId)?.kind ?? "EVENT",
    positionX: positions.get(node.nodeId)?.positionX ?? 80 + index * 260,
    positionY: positions.get(node.nodeId)?.positionY ?? 160,
    isBiggestLeak: node.nodeId === biggestLeakId,
  }));

  const edges = calculateEdges(data.result);
  const demo = await isDemoDataset(ctx);

  const observed = features.observedJourney
    ? await loadObservedPaths(ctx, range, { onlyBuyers: true })
    : [];

  const plannedPath = data.nodes.map((n) => n.eventName).join(" → ");
  const offPlan = observed.filter((path) => !plannedPath.includes(path.path));
  const offPlanShare =
    observed.length === 0
      ? 0
      : offPlan.reduce((sum, p) => sum + p.people, 0) /
        observed.reduce((sum, p) => sum + p.people, 0);

  return (
    <>
      <PageHeader
        title={data.funnel.name}
        description={
          data.funnel.description ??
          `${data.funnel.mode.toLowerCase()} matching, ${Math.round(data.funnel.conversionWindowSeconds / 86400)} day conversion window.`
        }
        actions={
          available.length > 1 ? (
            <div className="flex gap-1">
              {available.map((funnel) => (
                <Link
                  key={funnel.id}
                  href={`/funnels?id=${funnel.id}`}
                  className={
                    funnel.id === selectedId
                      ? "rounded-md bg-accent-subtle px-2.5 py-1 text-xs font-medium text-accent"
                      : "rounded-md px-2.5 py-1 text-xs text-muted-foreground hover:bg-surface-muted"
                  }
                >
                  {funnel.name}
                </Link>
              ))}
            </div>
          ) : null
        }
      />

      <PageBody>
        {demo ? <DemoDataBanner /> : null}
        {canEdit ? (
          <>
            <FunnelEditor
              key={`${selectedId}-${data.funnel.updatedAt?.toISOString()}`}
              projectId={ctx.projectId}
              initial={{
                id: selectedId,
                name: data.funnel.name,
                mode: data.funnel.mode,
                windowDays: data.funnel.conversionWindowSeconds / 86400,
                steps: nodeRows
                  .sort((a, b) => a.stepIndex - b.stepIndex)
                  .map((n) => ({
                    id: n.id,
                    name: n.name,
                    eventName: n.matchRule.eventName,
                    target:
                      n.targetConversionRate === null
                        ? ""
                        : Math.round(n.targetConversionRate * 10000) / 100,
                  })),
              }}
            />
            <FunnelEditor projectId={ctx.projectId} />
          </>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-[var(--radius-card)] border border-border bg-surface px-4 py-3">
            <p className="text-2xs font-medium tracking-wide text-muted-foreground uppercase">
              Entered funnel
            </p>
            <p className="tabular mt-1 text-lg font-semibold">
              {formatNumber(data.result.totalEntered)}
            </p>
          </div>
          <div className="rounded-[var(--radius-card)] border border-border bg-surface px-4 py-3">
            <p className="text-2xs font-medium tracking-wide text-muted-foreground uppercase">
              Completed
            </p>
            <p className="tabular mt-1 text-lg font-semibold">
              {formatNumber(data.result.totalConverted)}
              <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                {formatPercent(data.result.overallConversionRate)}
              </span>
            </p>
          </div>
          <div className="rounded-[var(--radius-card)] border border-border bg-surface px-4 py-3">
            <p className="text-2xs font-medium tracking-wide text-muted-foreground uppercase">
              Revenue in window
            </p>
            <p className="tabular mt-1 text-lg font-semibold">
              {formatCurrency(data.result.totalRevenueMinor, ctx.baseCurrency, {
                compact: true,
              })}
            </p>
          </div>
        </div>

        <FunnelCanvas
          nodes={canvasNodes}
          edges={edges}
          currency={ctx.baseCurrency}
        />

        <Card>
          <CardHeader>
            <CardTitle>Step detail</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <thead>
                <tr>
                  <Th>Step</Th>
                  <Th className="text-right">Entered</Th>
                  <Th className="text-right">Converted</Th>
                  <Th className="text-right">Rate</Th>
                  <Th className="text-right">Target</Th>
                  <Th className="text-right">Variance</Th>
                  <Th className="text-right">Median time</Th>
                </tr>
              </thead>
              <tbody>
                {data.result.nodes.map((node) => (
                  <tr key={node.nodeId}>
                    <Td>
                      <span className="flex items-center gap-2">
                        {node.name}
                        {node.nodeId === biggestLeakId ? (
                          <Badge tone="negative">leak</Badge>
                        ) : null}
                      </span>
                    </Td>
                    <Td numeric>{formatNumber(node.entered)}</Td>
                    <Td numeric>{formatNumber(node.converted)}</Td>
                    <Td numeric>{formatPercent(node.conversionRate)}</Td>
                    <Td numeric>
                      {node.targetConversionRate === null
                        ? "—"
                        : formatPercent(node.targetConversionRate)}
                    </Td>
                    <Td numeric>
                      {node.varianceToTargetPoints === null ? (
                        "—"
                      ) : (
                        <span
                          className={
                            node.varianceToTargetPoints >= 0
                              ? "text-positive"
                              : "text-negative"
                          }
                        >
                          {node.varianceToTargetPoints > 0 ? "+" : ""}
                          {(node.varianceToTargetPoints * 100).toFixed(1)} pp
                        </span>
                      )}
                    </Td>
                    <Td numeric>
                      {node.medianTimeToConvertSeconds === null
                        ? "—"
                        : `${Math.round(node.medianTimeToConvertSeconds / 3600)}h`}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </CardContent>
        </Card>

        {features.observedJourney ? (
          <Card>
            <CardHeader>
              <CardTitle>Planned versus observed</CardTitle>
            </CardHeader>
            <CardContent>
              {observed.length > 0 ? (
                <>
                  <p className="mb-4 text-sm">
                    {(offPlanShare * 100).toFixed(0)}% of paying customers
                    followed a path that differs from the funnel drawn above.
                  </p>
                  <ul className="space-y-2">
                    {observed.slice(0, 6).map((path) => (
                      <li
                        key={path.path}
                        className="flex items-baseline justify-between gap-4 border-b border-border pb-2 text-xs last:border-0"
                      >
                        <span className="min-w-0 truncate text-muted-foreground">
                          {path.path}
                        </span>
                        <span className="tabular shrink-0 font-medium">
                          {formatNumber(path.people)} people
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <EmptyState
                  title="No observed paths yet"
                  description="Observed journeys are built from what people actually did, independent of the funnel drawn above. They appear once customers have completed a purchase."
                />
              )}
            </CardContent>
          </Card>
        ) : null}
      </PageBody>
    </>
  );
}
