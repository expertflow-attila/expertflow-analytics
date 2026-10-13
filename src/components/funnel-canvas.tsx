"use client";

import {
  Background,
  Controls,
  Handle,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { AlertTriangle } from "lucide-react";
import { useMemo, useState } from "react";

import "@xyflow/react/dist/style.css";

import type { EdgeMetrics, NodeMetrics } from "@/lib/analytics/funnel-core";
import { cn, formatCurrency, formatDuration, formatNumber, formatPercent } from "@/lib/utils";

export type CanvasNode = NodeMetrics & {
  kind: string;
  positionX: number;
  positionY: number;
  /** Set when this step is the largest revenue leak in the funnel. */
  isBiggestLeak: boolean;
};

type FunnelNodeData = {
  metrics: CanvasNode;
  currency: string;
  onSelect: (nodeId: string) => void;
  selected: boolean;
};

/**
 * A funnel node is a live metric tile, not a diagram box. The canvas is the
 * primary analytics surface, so the numbers have to be readable without
 * opening anything.
 */
function FunnelNodeCard({ data }: NodeProps) {
  const { metrics, currency, onSelect, selected } =
    data as unknown as FunnelNodeData;

  return (
    <button
      type="button"
      onClick={() => onSelect(metrics.nodeId)}
      aria-pressed={selected}
      className={cn(
        "w-56 rounded-[var(--radius-card)] border bg-surface px-3.5 py-3 text-left transition-colors",
        selected
          ? "border-accent ring-1 ring-accent"
          : "border-border hover:border-border-strong",
        metrics.isBiggestLeak && !selected && "border-negative/50",
      )}
    >
      <Handle type="target" position={Position.Left} className="!bg-border-strong" />

      <p className="truncate text-xs font-medium">{metrics.name}</p>

      <p className="tabular mt-2 text-lg font-semibold tracking-tight">
        {formatNumber(metrics.entered)}
        <span className="ml-1 text-2xs font-normal text-muted-foreground">
          entered
        </span>
      </p>

      {metrics.conversionRate === null ? (
        <p className="mt-1 text-2xs text-muted-foreground">final step</p>
      ) : (
        <div className="mt-1 flex items-baseline gap-1.5">
          <span className="tabular text-sm font-medium">
            {formatPercent(metrics.conversionRate)}
          </span>
          {metrics.varianceToTargetPoints === null ? null : (
            <span
              className={cn(
                "tabular text-2xs",
                metrics.varianceToTargetPoints >= 0
                  ? "text-positive"
                  : "text-negative",
              )}
            >
              {metrics.varianceToTargetPoints > 0 ? "+" : ""}
              {(metrics.varianceToTargetPoints * 100).toFixed(1)} pp
            </span>
          )}
        </div>
      )}

      {metrics.downstreamRevenueMinor > 0 ? (
        <p className="tabular mt-1.5 text-2xs text-muted-foreground">
          {formatCurrency(metrics.downstreamRevenueMinor, currency, {
            compact: true,
          })}{" "}
          downstream
        </p>
      ) : null}

      {metrics.isBiggestLeak ? (
        <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-negative-subtle px-1.5 py-0.5 text-2xs font-medium text-negative">
          <AlertTriangle className="size-3" aria-hidden />
          Revenue leak
        </p>
      ) : null}

      <Handle type="source" position={Position.Right} className="!bg-border-strong" />
    </button>
  );
}

const nodeTypes = { funnelNode: FunnelNodeCard };

export function FunnelCanvas({
  nodes,
  edges,
  currency,
}: {
  nodes: CanvasNode[];
  edges: EdgeMetrics[];
  currency: string;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(
    nodes.find((n) => n.isBiggestLeak)?.nodeId ?? nodes[0]?.nodeId ?? null,
  );

  const flowNodes = useMemo<Node[]>(
    () =>
      nodes.map((node) => ({
        id: node.nodeId,
        type: "funnelNode",
        position: { x: node.positionX, y: node.positionY },
        data: {
          metrics: node,
          currency,
          onSelect: setSelectedId,
          selected: selectedId === node.nodeId,
        },
        draggable: false,
      })),
    [nodes, currency, selectedId],
  );

  const flowEdges = useMemo<Edge[]>(
    () =>
      edges.map((edge) => ({
        id: `${edge.sourceNodeId}-${edge.targetNodeId}`,
        source: edge.sourceNodeId,
        target: edge.targetNodeId,
        animated: false,
        label:
          edge.conversionRate === null
            ? undefined
            : `${formatPercent(edge.conversionRate)}${
                edge.medianTimeSeconds
                  ? ` · ${formatDuration(edge.medianTimeSeconds)}`
                  : ""
              }`,
        labelStyle: { fontSize: 10, fill: "var(--muted-foreground)" },
        labelBgStyle: { fill: "var(--background)" },
        style: {
          stroke: "var(--border-strong)",
          // Line weight carries the drop-off, so the leak is visible at a glance.
          strokeWidth:
            edge.conversionRate === null
              ? 1
              : Math.max(1, Math.min(6, edge.conversionRate * 8)),
        },
      })),
    [edges],
  );

  const selected = nodes.find((n) => n.nodeId === selectedId) ?? null;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="h-[560px] overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface-muted">
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          nodeTypes={nodeTypes}
          fitView
          // A long funnel would otherwise be scaled down until the numbers on
          // each node are unreadable. Below this zoom the canvas pans instead,
          // because the metrics are the point of the view.
          fitViewOptions={{ padding: 0.1, minZoom: 0.62 }}
          proOptions={{ hideAttribution: true }}
          nodesConnectable={false}
          minZoom={0.4}
          maxZoom={1.5}
        >
          <Background gap={20} size={1} color="var(--border)" />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>

      <NodeDetailPanel node={selected} currency={currency} />
    </div>
  );
}

function NodeDetailPanel({
  node,
  currency,
}: {
  node: CanvasNode | null;
  currency: string;
}) {
  if (!node) {
    return (
      <aside className="rounded-[var(--radius-card)] border border-border bg-surface p-4">
        <p className="text-xs text-muted-foreground">
          Select a step to see its detail.
        </p>
      </aside>
    );
  }

  const rows: Array<{ label: string; value: string }> = [
    { label: "Entered", value: formatNumber(node.entered) },
    { label: "Converted", value: formatNumber(node.converted) },
    { label: "Conversion", value: formatPercent(node.conversionRate) },
    { label: "Drop-off", value: formatNumber(node.dropoff) },
    {
      label: "Median time to convert",
      value: formatDuration(node.medianTimeToConvertSeconds),
    },
    {
      label: "Downstream revenue",
      value: formatCurrency(node.downstreamRevenueMinor, currency, {
        compact: true,
      }),
    },
    {
      label: "Revenue per entered",
      value: formatCurrency(node.revenuePerEnteredMinor, currency),
    },
  ];

  return (
    <aside className="space-y-4 rounded-[var(--radius-card)] border border-border bg-surface p-4">
      <div>
        <p className="text-sm font-semibold tracking-tight">{node.name}</p>
        <p className="mt-0.5 text-2xs text-muted-foreground">
          Step {node.stepIndex + 1} · {node.kind.toLowerCase()}
        </p>
      </div>

      <dl className="space-y-2">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-baseline justify-between gap-3"
          >
            <dt className="text-xs text-muted-foreground">{row.label}</dt>
            <dd className="tabular text-xs font-medium">{row.value}</dd>
          </div>
        ))}
      </dl>

      {node.targetConversionRate !== null ? (
        <div className="rounded-md bg-surface-muted px-3 py-2.5">
          <p className="text-2xs font-medium tracking-wide text-muted-foreground uppercase">
            Plan vs reality
          </p>
          <p className="tabular mt-1 text-xs">
            Target {formatPercent(node.targetConversionRate)} · actual{" "}
            {formatPercent(node.conversionRate)}
          </p>
          {node.varianceToTargetPoints !== null ? (
            <p
              className={cn(
                "tabular mt-0.5 text-xs font-medium",
                node.varianceToTargetPoints >= 0
                  ? "text-positive"
                  : "text-negative",
              )}
            >
              {node.varianceToTargetPoints > 0 ? "+" : ""}
              {(node.varianceToTargetPoints * 100).toFixed(1)} percentage points
            </p>
          ) : null}
        </div>
      ) : null}
    </aside>
  );
}
