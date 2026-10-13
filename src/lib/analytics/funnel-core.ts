/**
 * Funnel calculation engine — pure core.
 *
 * Deliberately has no database dependency: it takes an ordered event stream
 * per actor and returns metrics. That makes every rule in here provable with
 * fixture data (see `funnel-core.test.ts`), which matters because these
 * numbers end up in revenue decisions.
 *
 * Definitions used throughout (also documented in docs/analytics.md):
 *
 *   entered(n)     unique actors who matched node n while still eligible
 *   converted(n)   entered(n) actors who went on to match node n+1 inside the
 *                  conversion window
 *   conversion(n)  converted(n) / entered(n)
 *   dropoff(n)     entered(n) - converted(n)
 *
 * An actor is counted at most once per node, no matter how many times they
 * fire the matching event. Funnels measure people, not events.
 */

export type FunnelMode = "STRICT" | "ORDERED" | "FLEXIBLE";

export type MatchFilter = {
  field: string;
  op: "eq" | "neq" | "contains" | "startsWith" | "gt" | "lt" | "exists";
  value?: string | number;
};

export type NodeSpec = {
  id: string;
  name: string;
  eventName: string;
  filters?: MatchFilter[];
  targetConversionRate?: number | null;
};

export type AnalyticsEvent = {
  eventName: string;
  timestamp: number;
  /** Anything addressable by a filter: properties plus flattened context. */
  attributes?: Record<string, unknown>;
  revenueMinor?: number | null;
};

/** One actor's complete, chronologically ordered event stream. */
export type ActorStream = {
  actorId: string;
  events: AnalyticsEvent[];
};

export type NodeMetrics = {
  nodeId: string;
  name: string;
  stepIndex: number;
  entered: number;
  converted: number;
  conversionRate: number | null;
  dropoff: number;
  dropoffRate: number | null;
  /** Median seconds from entering this node to entering the next one. */
  medianTimeToConvertSeconds: number | null;
  /** Revenue produced by actors at or after this node, within the window. */
  downstreamRevenueMinor: number;
  revenuePerEnteredMinor: number | null;
  targetConversionRate: number | null;
  /** actual − target, in percentage points. Null when no target is set. */
  varianceToTargetPoints: number | null;
};

export type FunnelResult = {
  nodes: NodeMetrics[];
  /** entered(first) → converted(last). Null when the first node had nobody. */
  overallConversionRate: number | null;
  totalEntered: number;
  totalConverted: number;
  totalRevenueMinor: number;
};

export type FunnelOptions = {
  mode: FunnelMode;
  conversionWindowSeconds: number;
};

/** Evaluates one filter against an event's attribute bag. */
function matchesFilter(event: AnalyticsEvent, filter: MatchFilter): boolean {
  const actual = event.attributes?.[filter.field];

  switch (filter.op) {
    case "exists":
      return actual !== undefined && actual !== null;
    case "eq":
      return String(actual) === String(filter.value);
    case "neq":
      return String(actual) !== String(filter.value);
    case "contains":
      return String(actual ?? "").includes(String(filter.value ?? ""));
    case "startsWith":
      return String(actual ?? "").startsWith(String(filter.value ?? ""));
    case "gt":
      return Number(actual) > Number(filter.value);
    case "lt":
      return Number(actual) < Number(filter.value);
    default:
      return false;
  }
}

export function matchesNode(event: AnalyticsEvent, node: NodeSpec): boolean {
  if (event.eventName !== node.eventName) return false;
  if (!node.filters?.length) return true;
  return node.filters.every((filter) => matchesFilter(event, filter));
}

/**
 * Finds the index of the first event at or after `fromIndex` that matches
 * `node`, honouring the funnel mode.
 *
 *  STRICT   — the very next event must match
 *  ORDERED  — any later event may match; intervening events are ignored
 *  FLEXIBLE — same as ORDERED here; the modes diverge only in that FLEXIBLE
 *             also allows the actor to have matched the node earlier
 */
function findMatch(
  events: AnalyticsEvent[],
  node: NodeSpec,
  fromIndex: number,
  mode: FunnelMode,
  deadline: number,
): number {
  if (mode === "STRICT") {
    const next = events[fromIndex];
    if (!next) return -1;
    if (next.timestamp > deadline) return -1;
    return matchesNode(next, node) ? fromIndex : -1;
  }

  for (let i = fromIndex; i < events.length; i++) {
    const event = events[i];
    if (event.timestamp > deadline) return -1;
    if (matchesNode(event, node)) return i;
  }
  return -1;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/**
 * Walks every actor through the funnel once and aggregates the result.
 *
 * The conversion window is anchored on the actor's entry into the FIRST node,
 * not on each step. A "30 day funnel" means the whole journey completed inside
 * 30 days — anchoring per step would silently allow unbounded total duration.
 */
export function calculateFunnel(
  nodes: NodeSpec[],
  actors: ActorStream[],
  options: FunnelOptions,
): FunnelResult {
  if (nodes.length === 0) {
    return {
      nodes: [],
      overallConversionRate: null,
      totalEntered: 0,
      totalConverted: 0,
      totalRevenueMinor: 0,
    };
  }

  const windowMs = options.conversionWindowSeconds * 1000;

  const entered = nodes.map(() => 0);
  const converted = nodes.map(() => 0);
  const timeToConvert: number[][] = nodes.map(() => []);
  const downstreamRevenue = nodes.map(() => 0);

  let totalRevenue = 0;

  for (const actor of actors) {
    const events = [...actor.events].sort((a, b) => a.timestamp - b.timestamp);

    // Locate entry into the first node.
    const firstIndex = events.findIndex((event) => matchesNode(event, nodes[0]));
    if (firstIndex === -1) continue;

    const anchor = events[firstIndex].timestamp;
    const deadline = anchor + windowMs;

    /** Index into `events` of each node the actor reached. */
    const reachedAt: number[] = [firstIndex];
    let cursor = firstIndex;

    for (let step = 1; step < nodes.length; step++) {
      const searchFrom = options.mode === "STRICT" ? cursor + 1 : cursor + 1;
      const found = findMatch(
        events,
        nodes[step],
        searchFrom,
        options.mode,
        deadline,
      );
      if (found === -1) break;
      reachedAt.push(found);
      cursor = found;
    }

    // Revenue attributable to this actor inside the window.
    const actorRevenue = events
      .filter(
        (event) =>
          event.timestamp >= anchor &&
          event.timestamp <= deadline &&
          typeof event.revenueMinor === "number",
      )
      .reduce((sum, event) => sum + (event.revenueMinor ?? 0), 0);

    totalRevenue += actorRevenue;

    for (let step = 0; step < reachedAt.length; step++) {
      entered[step] += 1;
      downstreamRevenue[step] += actorRevenue;

      if (step + 1 < reachedAt.length) {
        converted[step] += 1;
        timeToConvert[step].push(
          (events[reachedAt[step + 1]].timestamp -
            events[reachedAt[step]].timestamp) /
            1000,
        );
      }
    }
  }

  const nodeMetrics: NodeMetrics[] = nodes.map((node, step) => {
    const isLast = step === nodes.length - 1;
    const enteredCount = entered[step];
    const convertedCount = isLast ? enteredCount : converted[step];

    const conversionRate =
      isLast || enteredCount === 0 ? null : convertedCount / enteredCount;

    const target = node.targetConversionRate ?? null;

    return {
      nodeId: node.id,
      name: node.name,
      stepIndex: step,
      entered: enteredCount,
      converted: isLast ? enteredCount : converted[step],
      conversionRate,
      dropoff: isLast ? 0 : enteredCount - converted[step],
      dropoffRate:
        isLast || enteredCount === 0 || conversionRate === null
          ? null
          : 1 - conversionRate,
      medianTimeToConvertSeconds: median(timeToConvert[step]),
      downstreamRevenueMinor: downstreamRevenue[step],
      revenuePerEnteredMinor:
        enteredCount === 0
          ? null
          : Math.round(downstreamRevenue[step] / enteredCount),
      targetConversionRate: target,
      varianceToTargetPoints:
        target === null || conversionRate === null
          ? null
          : conversionRate - target,
    };
  });

  const first = nodeMetrics[0];
  const last = nodeMetrics[nodeMetrics.length - 1];

  return {
    nodes: nodeMetrics,
    overallConversionRate:
      first.entered === 0 ? null : last.entered / first.entered,
    totalEntered: first.entered,
    totalConverted: last.entered,
    totalRevenueMinor: totalRevenue,
  };
}

/**
 * Edge metrics for the canvas. Derived from node metrics so the two views can
 * never disagree.
 */
export type EdgeMetrics = {
  sourceNodeId: string;
  targetNodeId: string;
  transitions: number;
  conversionRate: number | null;
  dropoff: number;
  medianTimeSeconds: number | null;
  /** Revenue that flows past this edge — the cost of the drop-off. */
  revenueThroughMinor: number;
};

export function calculateEdges(result: FunnelResult): EdgeMetrics[] {
  const edges: EdgeMetrics[] = [];

  for (let i = 0; i < result.nodes.length - 1; i++) {
    const from = result.nodes[i];
    const to = result.nodes[i + 1];

    edges.push({
      sourceNodeId: from.nodeId,
      targetNodeId: to.nodeId,
      transitions: to.entered,
      conversionRate: from.conversionRate,
      dropoff: from.dropoff,
      medianTimeSeconds: from.medianTimeToConvertSeconds,
      revenueThroughMinor: to.downstreamRevenueMinor,
    });
  }

  return edges;
}
