import { loadAttributionSettings } from "@/server/analytics/attribution-settings";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";

import {
  detectAnomalies,
  calculateTrackingHealth,
} from "@/lib/analytics/anomaly-core";
import {
  attributeByChannel,
  attributionConfidence,
  type AttributionModel,
} from "@/lib/analytics/attribution-core";
import { calculateCohorts } from "@/lib/analytics/ltv-core";
import { rankOpportunities } from "@/lib/analytics/opportunity-core";
import { simulate } from "@/lib/analytics/simulation-core";
import { db } from "@/server/db";
import { funnels } from "@/server/db/schema";
import {
  listJourneys,
  loadConversions,
  loadCustomers,
  loadDailySeries,
  loadFunnel,
  loadJourney,
  loadObservedPaths,
  loadOverview,
  loadTrackingHealthInput,
  previousRange,
  rangeDays,
  type DateRange,
} from "@/server/analytics/queries";
import type { TenantContext } from "@/server/tenancy";

/**
 * The analytics toolset exposed to the AI Analyst.
 *
 * This is the whole safety model of the AI feature. The model chooses which
 * tool to call and how to interpret the result; it never computes a business
 * metric itself. Every number that reaches a user has come out of the same
 * deterministic engines the rest of the product uses, so the AI cannot invent
 * revenue, conversion rates or confidence.
 *
 * Every tool is bound to a TenantContext by the caller, so a tool call cannot
 * reach another organization's data no matter what the model asks for.
 */

export type ToolContext = {
  ctx: TenantContext;
  defaultRange: DateRange;
};

export type ToolDefinition = {
  name: string;
  description: string;
  schema: z.ZodType;
  /** JSON Schema for the provider's function-calling API. */
  parameters: Record<string, unknown>;
  run: (args: Record<string, unknown>, tools: ToolContext) => Promise<unknown>;
};

const rangeParam = {
  type: "object",
  properties: {
    days: {
      type: "number",
      description:
        "How many days back from today. Defaults to the current view.",
    },
  },
  additionalProperties: false,
};

const rangeSchema = z.object({
  days: z.number().int().min(1).max(730).optional(),
});

function resolve(tools: ToolContext, days?: number): DateRange {
  if (!days) return tools.defaultRange;
  const to = new Date();
  return { from: new Date(to.getTime() - days * 86_400_000), to };
}

function money(minor: number | null | undefined, currency: string) {
  if (minor === null || minor === undefined) return null;
  return {
    minorUnits: minor,
    formatted: `${(minor / 100).toFixed(2)} ${currency}`,
  };
}

async function firstFunnelId(ctx: TenantContext): Promise<string | null> {
  const [row] = await db
    .select({ id: funnels.id })
    .from(funnels)
    .where(eq(funnels.projectId, ctx.projectId))
    .orderBy(desc(funnels.createdAt))
    .limit(1);
  return row?.id ?? null;
}

export const ANALYTICS_TOOLS: ToolDefinition[] = [
  {
    name: "get_overview_metrics",
    description:
      "Headline metrics for a period: visitors, leads, customers, gross and net revenue, orders, AOV, revenue per visitor and MRR.",
    schema: rangeSchema,
    parameters: rangeParam,
    async run(args, tools) {
      const range = resolve(tools, args.days as number | undefined);
      const current = await loadOverview(tools.ctx, range);
      const currency = tools.ctx.baseCurrency;

      return {
        periodDays: rangeDays(range),
        visitors: current.visitors,
        leads: current.leads,
        customers: current.customers,
        orders: current.ordersCount,
        grossRevenue: money(current.grossRevenueMinor, currency),
        netRevenue: money(current.netRevenueMinor, currency),
        refunded: money(current.refundedMinor, currency),
        averageOrderValue: money(current.averageOrderValueMinor, currency),
        revenuePerVisitor: money(current.revenuePerVisitorMinor, currency),
        mrr: money(current.mrrMinor, currency),
      };
    },
  },

  {
    name: "compare_periods",
    description:
      "Compares the headline metrics of a period against the immediately preceding period of equal length.",
    schema: rangeSchema,
    parameters: rangeParam,
    async run(args, tools) {
      const range = resolve(tools, args.days as number | undefined);
      const previous = previousRange(range);
      const [current, prior] = await Promise.all([
        loadOverview(tools.ctx, range),
        loadOverview(tools.ctx, previous),
      ]);

      const change = (a: number, b: number) =>
        b === 0 ? null : Math.round(((a - b) / b) * 1000) / 1000;

      return {
        periodDays: rangeDays(range),
        current,
        previous: prior,
        relativeChange: {
          visitors: change(current.visitors, prior.visitors),
          leads: change(current.leads, prior.leads),
          customers: change(current.customers, prior.customers),
          netRevenue: change(current.netRevenueMinor, prior.netRevenueMinor),
        },
        note: "Relative change is null where the previous period was zero; it is not reported as an infinite increase.",
      };
    },
  },

  {
    name: "get_funnel_metrics",
    description:
      "Per-step funnel metrics: people entering, converting, conversion rate, drop-off, median time to convert, downstream revenue, and variance against the step's target.",
    schema: rangeSchema.extend({ funnelId: z.string().optional() }),
    parameters: {
      type: "object",
      properties: {
        days: rangeParam.properties.days,
        funnelId: {
          type: "string",
          description: "Defaults to the newest funnel.",
        },
      },
      additionalProperties: false,
    },
    async run(args, tools) {
      const range = resolve(tools, args.days as number | undefined);
      const funnelId =
        (args.funnelId as string | undefined) ??
        (await firstFunnelId(tools.ctx));
      if (!funnelId) return { error: "This project has no funnel yet." };

      const data = await loadFunnel(tools.ctx, funnelId, range);
      if (!data) return { error: "Funnel not found." };

      return {
        funnel: data.funnel.name,
        mode: data.funnel.mode,
        conversionWindowDays: Math.round(
          data.funnel.conversionWindowSeconds / 86_400,
        ),
        overallConversionRate: data.result.overallConversionRate,
        steps: data.result.nodes.map((node) => ({
          name: node.name,
          entered: node.entered,
          converted: node.converted,
          conversionRate: node.conversionRate,
          dropoff: node.dropoff,
          medianTimeToConvertSeconds: node.medianTimeToConvertSeconds,
          targetConversionRate: node.targetConversionRate,
          varianceToTargetPercentagePoints:
            node.varianceToTargetPoints === null
              ? null
              : Math.round(node.varianceToTargetPoints * 1000) / 10,
          downstreamRevenue: money(
            node.downstreamRevenueMinor,
            tools.ctx.baseCurrency,
          ),
        })),
        note: "Variance is in percentage points, not percent. The final step has no conversion rate because nothing follows it.",
      };
    },
  },

  {
    name: "get_opportunities",
    description:
      "Ranked revenue opportunities with estimated monthly upside, the score components behind the ranking, and a confidence band derived from sample size and observed revenue.",
    schema: rangeSchema,
    parameters: rangeParam,
    async run(args, tools) {
      const range = resolve(tools, args.days as number | undefined);
      const funnelId = await firstFunnelId(tools.ctx);
      if (!funnelId) return { error: "This project has no funnel yet." };

      const data = await loadFunnel(tools.ctx, funnelId, range);
      if (!data) return { error: "Funnel not found." };

      const opportunities = rankOpportunities(
        data.result.nodes
          .filter((node) => node.conversionRate !== null)
          .map((node) => ({
            node,
            downstreamRevenuePerConversionMinor:
              node.converted === 0
                ? 0
                : Math.round(node.downstreamRevenueMinor / node.converted),
            periodDays: rangeDays(range),
            effort: 3,
          })),
        { kind: "TARGET" },
      );

      return {
        opportunities: opportunities.map((o) => ({
          step: o.nodeName,
          currentConversionRate: o.currentConversionRate,
          targetConversionRate: o.targetConversionRate,
          eligiblePeople: o.eligibleUsers,
          estimatedMonthlyUpside: money(
            o.estimatedMonthlyUpsideMinor,
            tools.ctx.baseCurrency,
          ),
          confidence: o.confidence,
          confidenceReason: o.confidenceReason,
          score: o.opportunityScore,
          scoreComponents: {
            revenueImpact: o.revenueImpactScore,
            reach: o.reachScore,
            persistence: o.persistenceScore,
            effort: o.effortScore,
          },
        })),
        note: "Upside is an estimate from observed downstream revenue, not a forecast, and makes no claim the improvement is achievable. Opportunities only exist for steps with a conversion target set.",
      };
    },
  },

  {
    name: "get_channel_performance",
    description:
      "Attributed revenue by channel under one attribution model, with the number of conversions credited.",
    schema: rangeSchema.extend({
      model: z
        .enum(["FIRST_TOUCH", "LAST_TOUCH", "LINEAR", "U_SHAPED"])
        .optional(),
    }),
    parameters: {
      type: "object",
      properties: {
        days: rangeParam.properties.days,
        model: {
          type: "string",
          enum: ["FIRST_TOUCH", "LAST_TOUCH", "LINEAR", "U_SHAPED"],
        },
      },
      additionalProperties: false,
    },
    async run(args, tools) {
      const range = resolve(tools, args.days as number | undefined);
      const settings = await loadAttributionSettings(tools.ctx);
      const model = (args.model as AttributionModel) ?? settings.model;
      const { conversions, unattributableOrders } = await loadConversions(
        tools.ctx,
        range,
        settings.windowDays,
      );

      const rows = attributeByChannel(conversions, {
        ...settings,
        model,
      });

      return {
        model,
        channels: rows.map((row) => ({
          channel: row.channel,
          attributedRevenue: money(
            row.attributedRevenueMinor,
            tools.ctx.baseCurrency,
          ),
          attributedConversions: row.attributedConversions,
        })),
        unattributableOrders,
        note: "Attributed revenue is not the same as revenue; it is revenue after being split across touchpoints by this model.",
      };
    },
  },

  {
    name: "compare_attribution_models",
    description:
      "Compares four attribution models side by side per channel and reports how far apart they are, as an Attribution Confidence band.",
    schema: rangeSchema,
    parameters: rangeParam,
    async run(args, tools) {
      const range = resolve(tools, args.days as number | undefined);
      const settings = await loadAttributionSettings(tools.ctx);
      const { conversions } = await loadConversions(
        tools.ctx,
        range,
        settings.windowDays,
      );

      const rows = attributionConfidence(conversions, {
        ...settings,
      });

      return {
        channels: rows.map((row) => ({
          channel: row.channel,
          disagreement: row.disagreement,
          agreementBand: row.band,
          perModel: Object.fromEntries(
            Object.entries(row.perModelRevenueMinor).map(([model, minor]) => [
              model,
              money(minor, tools.ctx.baseCurrency),
            ]),
          ),
        })),
        note: "Attribution Confidence is the normalised spread between models. It is NOT a statistical confidence interval. A low band means the choice of model changes the answer materially.",
      };
    },
  },

  {
    name: "get_cohorts",
    description:
      "Cohort LTV by acquisition month or channel, with CAC and payback where marketing spend is known.",
    schema: z.object({ by: z.enum(["month", "channel"]).optional() }),
    parameters: {
      type: "object",
      properties: { by: { type: "string", enum: ["month", "channel"] } },
      additionalProperties: false,
    },
    async run(args, tools) {
      const by = (args.by as "month" | "channel") ?? "month";
      const customers = await loadCustomers(tools.ctx, by);
      const cohorts = calculateCohorts(customers);

      return {
        groupedBy: by,
        cohorts: cohorts.map((cohort) => ({
          cohort: cohort.cohortKey,
          customers: cohort.customers,
          ltv: Object.fromEntries(
            Object.entries(cohort.ltvByHorizon).map(([days, minor]) => [
              `${days}d`,
              money(minor, tools.ctx.baseCurrency),
            ]),
          ),
          lifetimeLtv: money(cohort.lifetimeLtvMinor, tools.ctx.baseCurrency),
          cac: money(cohort.cac, tools.ctx.baseCurrency),
          paybackDays: cohort.paybackDays,
          paybackStatus: cohort.paybackStatus,
        })),
        note: "An LTV horizon is null until it has fully elapsed for the cohort. CAC and payback are unavailable without marketing spend, and are never estimated.",
      };
    },
  },

  {
    name: "detect_anomalies",
    description:
      "Days where visitors, leads or revenue moved unusually against a rolling, weekday-aware baseline.",
    schema: rangeSchema,
    parameters: rangeParam,
    async run(args, tools) {
      const range = resolve(tools, args.days as number | undefined);
      const series = await loadDailySeries(tools.ctx, range);

      return {
        anomalies: [
          ...detectAnomalies("visitors", series.visitors),
          ...detectAnomalies("leads", series.leads),
          ...detectAnomalies("revenue", series.revenue),
        ]
          .sort(
            (a, b) => Math.abs(b.changeFraction) - Math.abs(a.changeFraction),
          )
          .slice(0, 20),
        note: "A day is reported only when the move is both statistically unusual and materially large. Nothing here implies a cause.",
      };
    },
  },

  {
    name: "get_tracking_health",
    description:
      "Data quality score and the individual checks behind it, with a recommended fix for each failing check.",
    schema: rangeSchema,
    parameters: rangeParam,
    async run(args, tools) {
      const range = resolve(tools, args.days as number | undefined);
      const input = await loadTrackingHealthInput(tools.ctx, range);
      const health = calculateTrackingHealth(input);

      return {
        score: health.score,
        unavailableReason: health.unavailableReason,
        checks: health.checks,
        note: "A score of null means there is no data to assess. Any conclusion drawn while this score is low must be qualified.",
      };
    },
  },

  {
    name: "get_top_journeys",
    description:
      "The most common observed paths people actually take, independent of any funnel that was drawn.",
    schema: rangeSchema.extend({ onlyBuyers: z.boolean().optional() }),
    parameters: {
      type: "object",
      properties: {
        days: rangeParam.properties.days,
        onlyBuyers: { type: "boolean" },
      },
      additionalProperties: false,
    },
    async run(args, tools) {
      const range = resolve(tools, args.days as number | undefined);
      const paths = await loadObservedPaths(tools.ctx, range, {
        onlyBuyers: Boolean(args.onlyBuyers),
      });

      return {
        paths: paths.slice(0, 15),
        note: "Built from identified people only. Page views are excluded because they dominate every path without carrying funnel meaning.",
      };
    },
  },

  {
    name: "get_customer_journey",
    description:
      "One person's full timeline: events, marketing touchpoints and orders in chronological order.",
    schema: z.object({ personId: z.string() }),
    parameters: {
      type: "object",
      properties: { personId: { type: "string" } },
      required: ["personId"],
      additionalProperties: false,
    },
    async run(args, tools) {
      const journey = await loadJourney(tools.ctx, String(args.personId));
      if (!journey) return { error: "No such person in this project." };

      return {
        person: {
          name: journey.person.name,
          email: journey.person.email,
          lifetimeRevenue: money(
            journey.person.lifetimeRevenueMinor,
            tools.ctx.baseCurrency,
          ),
        },
        timeline: journey.timeline.map((event) => ({
          event: event.eventName,
          at: event.timestamp,
          channel: event.channel,
          campaign: event.utmCampaign,
          revenue: money(event.revenueMinor, tools.ctx.baseCurrency),
        })),
        touchpoints: journey.touchpoints.length,
        orders: journey.orders.length,
      };
    },
  },

  {
    name: "list_top_customers",
    description:
      "Highest lifetime revenue customers with their first and last touch channel.",
    schema: z.object({ limit: z.number().int().min(1).max(50).optional() }),
    parameters: {
      type: "object",
      properties: { limit: { type: "number" } },
      additionalProperties: false,
    },
    async run(args, tools) {
      const people = await listJourneys(tools.ctx, {
        limit: Math.min(50, Number(args.limit) || 10),
        onlyCustomers: true,
      });

      return {
        customers: people.map((person) => ({
          personId: person.id,
          name: person.name,
          firstTouchChannel: person.firstTouchChannel,
          lastTouchChannel: person.lastTouchChannel,
          lifetimeRevenue: money(
            person.lifetimeRevenueMinor,
            tools.ctx.baseCurrency,
          ),
        })),
      };
    },
  },

  {
    name: "simulate_funnel_change",
    description:
      "What-if arithmetic. Recomputes customers, revenue, CAC and ROAS from supplied traffic, step conversion rates and order value. This is NOT a forecast.",
    schema: z.object({
      traffic: z.number().min(0),
      stepConversionRates: z.array(z.number().min(0).max(1)),
      averageOrderValueMinor: z.number().min(0),
      adSpendMinor: z.number().min(0).optional(),
    }),
    parameters: {
      type: "object",
      properties: {
        traffic: { type: "number" },
        stepConversionRates: {
          type: "array",
          items: { type: "number" },
          description: "Per-step rates as fractions, in order.",
        },
        averageOrderValueMinor: {
          type: "number",
          description: "In minor units (cents).",
        },
        adSpendMinor: { type: "number" },
      },
      required: ["traffic", "stepConversionRates", "averageOrderValueMinor"],
      additionalProperties: false,
    },
    async run(args, tools) {
      const result = simulate({
        traffic: Number(args.traffic),
        stepConversionRates: (args.stepConversionRates as number[]) ?? [],
        averageOrderValueMinor: Number(args.averageOrderValueMinor),
        adSpendMinor: args.adSpendMinor as number | undefined,
      });

      return {
        ...result,
        grossRevenue: money(result.grossRevenueMinor, tools.ctx.baseCurrency),
        note: "Simulation is what-if arithmetic on the inputs given. It makes no claim that the inputs are achievable and is not a prediction.",
      };
    },
  },
];

export function toolByName(name: string): ToolDefinition | null {
  return ANALYTICS_TOOLS.find((tool) => tool.name === name) ?? null;
}
