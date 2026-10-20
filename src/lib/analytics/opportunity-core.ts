/**
 * Opportunity Engine — pure core.
 *
 * Answers the product's central question: if this one funnel step improved,
 * how much additional revenue would actually appear downstream?
 *
 * The model is deliberately simple and fully documented (docs/analytics.md).
 * A simple model whose assumptions are visible beats a sophisticated one whose
 * assumptions are hidden — every figure here is an ESTIMATE, and the UI is
 * required to label it as such.
 *
 *   additionalConversions = eligibleUsers × improvement
 *   additionalRevenue     = additionalConversions × downstreamRevenuePerConversion
 *   additionalProfit      = additionalRevenue − incrementalCosts
 *
 * `downstreamRevenuePerConversion` is measured, not assumed: it is the observed
 * revenue per actor who cleared this step during the analysis period.
 */

import type { NodeMetrics } from "./funnel-core";

export type ImprovementScenario =
  | { kind: "ABSOLUTE_POINTS"; points: number }
  | { kind: "RELATIVE"; fraction: number }
  | { kind: "TARGET" }
  | { kind: "CUSTOM"; targetRate: number };

export type OpportunityInput = {
  node: NodeMetrics;
  /** Revenue observed per actor who converted THROUGH this step. */
  downstreamRevenuePerConversionMinor: number;
  /** Days covered by the metrics, used to normalise to a monthly figure. */
  periodDays: number;
  /** Optional known cost of capturing the extra conversions. */
  incrementalCostMinor?: number;
  /** How stable this step's conversion rate has been; see `persistence`. */
  historicalRates?: number[];
  /** Relative effort estimate, 1 (trivial) to 5 (major project). */
  effort?: number;
};

export type Opportunity = {
  nodeId: string;
  nodeName: string;
  currentConversionRate: number;
  targetConversionRate: number;
  improvementPoints: number;
  eligibleUsers: number;
  additionalConversions: number;
  estimatedMonthlyUpsideMinor: number;
  estimatedMonthlyProfitMinor: number | null;
  downstreamRevenuePerConversionMinor: number;

  revenueImpactScore: number;
  reachScore: number;
  persistenceScore: number;
  effortScore: number;
  opportunityScore: number;

  confidence: "HIGH" | "MEDIUM" | "LOW" | "UNAVAILABLE";
  confidenceReason: string;
  assumptions: Record<string, unknown>;
};

const DAYS_PER_MONTH = 30;

function resolveTargetRate(
  node: NodeMetrics,
  scenario: ImprovementScenario,
): number | null {
  const current = node.conversionRate;
  if (current === null) return null;

  switch (scenario.kind) {
    case "ABSOLUTE_POINTS":
      return Math.min(1, current + scenario.points);
    case "RELATIVE":
      return Math.min(1, current * (1 + scenario.fraction));
    case "TARGET":
      return node.targetConversionRate ?? null;
    case "CUSTOM":
      return Math.min(1, scenario.targetRate);
  }
}

/**
 * Persistence: how consistently this step underperforms.
 *
 * A step that has been weak for weeks is a structural problem worth fixing.
 * A step that dipped once may simply be noise, and ranking it first would send
 * someone chasing a ghost. Scored 0–1 as the inverse of relative volatility.
 */
function persistence(historicalRates: number[] | undefined): number {
  if (!historicalRates || historicalRates.length < 3) return 0.5;

  const mean =
    historicalRates.reduce((a, b) => a + b, 0) / historicalRates.length;
  if (mean === 0) return 0.5;

  const variance =
    historicalRates.reduce((sum, r) => sum + (r - mean) ** 2, 0) /
    historicalRates.length;
  const coefficientOfVariation = Math.sqrt(variance) / mean;

  return Math.max(0, Math.min(1, 1 - coefficientOfVariation));
}

/**
 * Confidence is derived from the data, never chosen. Small samples and missing
 * revenue signal both force it down, and the reason is always surfaced.
 */
function assessConfidence(input: OpportunityInput): {
  confidence: Opportunity["confidence"];
  reason: string;
} {
  const { node, downstreamRevenuePerConversionMinor } = input;

  if (node.entered === 0) {
    return {
      confidence: "UNAVAILABLE",
      reason:
        "Ebben az időszakban senki nem lépett be a tölcsér ezen pontjára.",
    };
  }

  if (downstreamRevenuePerConversionMinor <= 0) {
    return {
      confidence: "UNAVAILABLE",
      reason:
        "E lépés után még nincs megfigyelt bevétel, ezért többletbevétel nem becsülhető.",
    };
  }

  if (node.entered < 100) {
    return {
      confidence: "LOW",
      reason: `Csak ${node.entered.toLocaleString("hu-HU")} fő lépett be erre a lépésre; a konverziós arány még nem stabil.`,
    };
  }

  if (node.entered < 500) {
    return {
      confidence: "MEDIUM",
      reason: `${node.entered.toLocaleString("hu-HU")} fő lépett be erre a lépésre. Ez az irány megítéléséhez elegendő, pontos becsléshez még kevés.`,
    };
  }

  return {
    confidence: "HIGH",
    reason: `${node.entered.toLocaleString("hu-HU")} fő lépett be erre a lépésre, és a későbbi lépésekből bevétel is megfigyelhető.`,
  };
}

export function calculateOpportunity(
  input: OpportunityInput,
  scenario: ImprovementScenario = { kind: "ABSOLUTE_POINTS", points: 0.01 },
): Opportunity | null {
  const { node, periodDays, downstreamRevenuePerConversionMinor } = input;

  const current = node.conversionRate;
  if (current === null) return null;

  const target = resolveTargetRate(node, scenario);
  if (target === null || target <= current) return null;

  const improvementPoints = target - current;
  const additionalConversions = node.entered * improvementPoints;

  const periodUpside =
    additionalConversions * downstreamRevenuePerConversionMinor;
  const monthlyUpside = Math.round(
    (periodUpside / Math.max(1, periodDays)) * DAYS_PER_MONTH,
  );

  const incrementalCost = input.incrementalCostMinor ?? null;
  const monthlyProfit =
    incrementalCost === null ? null : monthlyUpside - incrementalCost;

  const { confidence, reason } = assessConfidence(input);

  // Score components are kept separate and surfaced in the UI so nobody has to
  // take the ranking on faith.
  const revenueImpactScore = Math.log10(Math.max(1, monthlyUpside / 100)) / 5;
  const reachScore = Math.min(1, node.entered / 1000);
  const persistenceScore = persistence(input.historicalRates);
  const effortScore = Math.max(1, Math.min(5, input.effort ?? 3));

  const confidenceWeight =
    confidence === "HIGH"
      ? 1
      : confidence === "MEDIUM"
        ? 0.7
        : confidence === "LOW"
          ? 0.4
          : 0;

  const opportunityScore =
    (revenueImpactScore * confidenceWeight * reachScore * persistenceScore) /
    effortScore;

  return {
    nodeId: node.nodeId,
    nodeName: node.name,
    currentConversionRate: current,
    targetConversionRate: target,
    improvementPoints,
    eligibleUsers: node.entered,
    additionalConversions: Math.round(additionalConversions * 100) / 100,
    estimatedMonthlyUpsideMinor: monthlyUpside,
    estimatedMonthlyProfitMinor: monthlyProfit,
    downstreamRevenuePerConversionMinor,

    revenueImpactScore: Math.round(revenueImpactScore * 1000) / 1000,
    reachScore: Math.round(reachScore * 1000) / 1000,
    persistenceScore: Math.round(persistenceScore * 1000) / 1000,
    effortScore,
    opportunityScore: Math.round(opportunityScore * 10000) / 10000,

    confidence,
    confidenceReason: reason,
    assumptions: {
      scenario,
      periodDays,
      formula:
        "additionalConversions = eligibleUsers x improvementPoints; upside = additionalConversions x downstreamRevenuePerConversion, normalised to 30 days",
      downstreamRevenuePerConversionMinor,
      incrementalCostMinor: incrementalCost,
    },
  };
}

export function rankOpportunities(
  inputs: OpportunityInput[],
  scenario?: ImprovementScenario,
): Opportunity[] {
  return inputs
    .map((input) => calculateOpportunity(input, scenario))
    .filter((o): o is Opportunity => o !== null)
    .sort((a, b) => b.opportunityScore - a.opportunityScore);
}

/**
 * Revenue Gap: planned versus actual, decomposed by node.
 *
 * Only nodes with an explicit target contribute — we never invent a plan the
 * user did not state.
 */
export type RevenueGap = {
  expectedRevenueMinor: number;
  actualRevenueMinor: number;
  gapMinor: number;
  byNode: Array<{
    nodeId: string;
    nodeName: string;
    targetConversionRate: number;
    actualConversionRate: number;
    varianceToTargetPoints: number;
    estimatedGapContributionMinor: number;
  }>;
};

export function calculateRevenueGap(
  nodes: NodeMetrics[],
  downstreamRevenuePerConversionMinor: Record<string, number>,
  actualRevenueMinor: number,
): RevenueGap {
  const byNode: RevenueGap["byNode"] = [];
  let totalGap = 0;

  for (const node of nodes) {
    const target = node.targetConversionRate;
    const actual = node.conversionRate;
    if (target === null || actual === null) continue;

    const variance = actual - target;
    const perConversion =
      downstreamRevenuePerConversionMinor[node.nodeId] ??
      node.revenuePerEnteredMinor ??
      0;

    const contribution = Math.round(node.entered * variance * perConversion);
    totalGap += contribution;

    byNode.push({
      nodeId: node.nodeId,
      nodeName: node.name,
      targetConversionRate: target,
      actualConversionRate: actual,
      varianceToTargetPoints: variance,
      estimatedGapContributionMinor: contribution,
    });
  }

  return {
    expectedRevenueMinor: actualRevenueMinor - totalGap,
    actualRevenueMinor,
    gapMinor: totalGap,
    byNode: byNode.sort(
      (a, b) =>
        a.estimatedGapContributionMinor - b.estimatedGapContributionMinor,
    ),
  };
}
