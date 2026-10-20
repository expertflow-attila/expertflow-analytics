import test from "node:test";
import assert from "node:assert/strict";
import {
  simulate,
  compareScenarios,
} from "../src/lib/analytics/simulation-core";
import {
  calculateCohorts,
  summariseRevenue,
} from "../src/lib/analytics/ltv-core";
import { calculateOpportunity } from "../src/lib/analytics/opportunity-core";
const D = 86400000;
test("simulation: independent 1000×50%×20% cash-flow fixture", () => {
  const r = simulate({
    traffic: 1000,
    stepConversionRates: [0.5, 0.2],
    averageOrderValueMinor: 10000,
    adSpendMinor: 200000,
    expansionRevenuePerCustomerMinor: 5000,
  });
  assert.equal(r.customers, 100);
  assert.equal(r.grossRevenueMinor, 1000000);
  assert.equal(r.lifetimeRevenueMinor, 1500000);
  assert.equal(r.cacMinor, 2000);
  assert.equal(r.roas, 5);
  assert.equal(r.profitMinor, 800000);
});
test("simulation: missing spend remains unavailable; zero traffic finite", () => {
  const r = simulate({
    traffic: 0,
    stepConversionRates: [0.5],
    averageOrderValueMinor: 10000,
  });
  assert.equal(r.cacMinor, null);
  assert.equal(r.profitMinor, null);
  assert.equal(r.revenuePerVisitorMinor, 0);
});
test("simulation: improving one step doubles customers without changing baseline", () => {
  const r = compareScenarios(
    {
      traffic: 1000,
      stepConversionRates: [0.1],
      averageOrderValueMinor: 10000,
    },
    [{ name: "test", overrides: { stepConversionRates: [0.2] } }],
  );
  assert.equal(r[0].result.customers, 100);
  assert.equal(r[1].result.customers, 200);
});
test("LTV: refunds use refund date and immature horizons stay null", () => {
  const [r] = calculateCohorts(
    [
      {
        personId: "a",
        acquiredAt: 0,
        cohortKey: "cohort",
        orders: [{ occurredAt: 0, grossMinor: 10000 }],
        refunds: [{ occurredAt: 40 * D, amountMinor: 2000 }],
      },
    ],
    { asOf: 70 * D },
  );
  assert.equal(r.ltvByHorizon[30], 10000);
  assert.equal(r.ltvByHorizon[60], 8000);
  assert.equal(r.ltvByHorizon[90], null);
  assert.equal(r.cac, null);
  assert.equal(r.lifetimeLtvMinor, 8000);
});
test("LTV: late acquisition excluded from 30-day denominator", () => {
  const [r] = calculateCohorts(
    [
      {
        personId: "a",
        acquiredAt: 0,
        cohortKey: "x",
        orders: [{ occurredAt: 0, grossMinor: 10000 }],
        refunds: [],
      },
      {
        personId: "b",
        acquiredAt: 40 * D,
        cohortKey: "x",
        orders: [{ occurredAt: 40 * D, grossMinor: 20000 }],
        refunds: [],
      },
    ],
    { asOf: 50 * D },
  );
  assert.equal(r.ltvByHorizon[30], 10000);
});
test("revenue: net, AOV, unique customers and ARR", () => {
  const r = summariseRevenue({
    orders: [
      { personId: "a", grossMinor: 10000 },
      { personId: "a", grossMinor: 20000 },
    ],
    refunds: [{ amountMinor: 5000 }],
    activeSubscriptionsMrrMinor: 1000,
  });
  assert.equal(r.netRevenueMinor, 25000);
  assert.equal(r.averageOrderValueMinor, 15000);
  assert.equal(r.customersCount, 1);
  assert.equal(r.arrMinor, 12000);
});
const input: Parameters<typeof calculateOpportunity>[0] = {
  node: {
    nodeId: "a",
    name: "Lead",
    stepIndex: 0,
    dropoff: 900,
    dropoffRate: 0.9,
    medianTimeToConvertSeconds: null,
    downstreamRevenueMinor: 1000000,
    revenuePerEnteredMinor: 1000,
    varianceToTargetPoints: -0.1,
    entered: 1000,
    converted: 100,
    conversionRate: 0.1,
    targetConversionRate: 0.2,
  },
  downstreamRevenuePerConversionMinor: 10000,
  periodDays: 60,
};
test("opportunity: target gap is normalised to 30 days", () => {
  const r = calculateOpportunity(input, { kind: "TARGET" });
  assert.equal(r?.additionalConversions, 100);
  assert.equal(r?.estimatedMonthlyUpsideMinor, 500000);
  assert.equal(r?.estimatedMonthlyProfitMinor, null);
});
test("opportunity: no target cannot manufacture an opportunity", () => {
  assert.equal(
    calculateOpportunity(
      { ...input, node: { ...input.node, targetConversionRate: null } },
      { kind: "TARGET" },
    ),
    null,
  );
});
