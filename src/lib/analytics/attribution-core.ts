/**
 * Attribution engine — pure core.
 *
 * Every model distributes exactly 100% of a conversion's revenue across that
 * conversion's touchpoints. Rounding is handled explicitly so the credited
 * amounts always sum back to the original figure to the minor unit — a
 * reconciliation report that is off by a cent is a report nobody trusts.
 */

export type AttributionModel =
  | "FIRST_TOUCH"
  | "LAST_TOUCH"
  | "LINEAR"
  | "U_SHAPED"
  | "POSITION_BASED";

export type Touchpoint = {
  id: string;
  channel: string;
  source?: string | null;
  campaign?: string | null;
  occurredAt: number;
  /** Marks the touchpoint during which the person became a known lead. */
  isLeadConversion?: boolean;
};

export type Conversion = {
  id: string;
  personId: string;
  occurredAt: number;
  revenueMinor: number;
  touchpoints: Touchpoint[];
};

export type AttributionOptions = {
  model: AttributionModel;
  /** Touchpoints older than this many days before the conversion are ignored. */
  windowDays: number;
  includeDirect: boolean;
  includeOrganic: boolean;
  /** Only read for POSITION_BASED. U_SHAPED hard-codes 40/40/20. */
  firstTouchWeight?: number;
  leadTouchWeight?: number;
};

export type AttributedCredit = {
  conversionId: string;
  touchpointId: string;
  channel: string;
  campaign: string | null;
  creditFraction: number;
  creditMinor: number;
};

const ORGANIC_CHANNELS = new Set([
  "Organic Search",
  "Organic Social",
  "Referral",
  "Video",
]);

function eligibleTouchpoints(
  conversion: Conversion,
  options: AttributionOptions,
): Touchpoint[] {
  const windowMs = options.windowDays * 24 * 60 * 60 * 1000;
  const earliest = conversion.occurredAt - windowMs;

  return conversion.touchpoints
    .filter((tp) => tp.occurredAt >= earliest && tp.occurredAt <= conversion.occurredAt)
    .filter((tp) => {
      if (!options.includeDirect && (tp.channel === "Direct" || tp.channel === "Unknown")) {
        return false;
      }
      if (!options.includeOrganic && ORGANIC_CHANNELS.has(tp.channel)) {
        return false;
      }
      return true;
    })
    .sort((a, b) => a.occurredAt - b.occurredAt);
}

/** Returns the credit fraction for each touchpoint, summing to 1. */
export function weightsFor(
  touchpoints: Touchpoint[],
  options: AttributionOptions,
): number[] {
  const n = touchpoints.length;
  if (n === 0) return [];
  if (n === 1) return [1];

  switch (options.model) {
    case "FIRST_TOUCH": {
      const weights = new Array(n).fill(0);
      weights[0] = 1;
      return weights;
    }

    case "LAST_TOUCH": {
      const weights = new Array(n).fill(0);
      weights[n - 1] = 1;
      return weights;
    }

    case "LINEAR":
      return new Array(n).fill(1 / n);

    case "U_SHAPED":
    case "POSITION_BASED": {
      const firstWeight =
        options.model === "U_SHAPED" ? 0.4 : (options.firstTouchWeight ?? 0.4);
      const leadWeight =
        options.model === "U_SHAPED" ? 0.4 : (options.leadTouchWeight ?? 0.4);

      const weights = new Array(n).fill(0);

      // The "lead" position is the touchpoint that produced the lead. When no
      // touchpoint is flagged, fall back to the last one — that keeps the
      // model a genuine U rather than silently collapsing to first-touch.
      let leadIndex = touchpoints.findIndex((tp) => tp.isLeadConversion);
      if (leadIndex <= 0) leadIndex = n - 1;

      if (leadIndex === 0) {
        weights[0] = 1;
        return weights;
      }

      weights[0] += firstWeight;
      weights[leadIndex] += leadWeight;

      const middleWeight = Math.max(0, 1 - firstWeight - leadWeight);
      const middleIndices: number[] = [];
      for (let i = 1; i < n; i++) {
        if (i !== leadIndex) middleIndices.push(i);
      }

      if (middleIndices.length === 0) {
        // No middle touchpoints: redistribute proportionally so the weights
        // still sum to 1 instead of leaking credit.
        const total = firstWeight + leadWeight;
        weights[0] = firstWeight / total;
        weights[leadIndex] = leadWeight / total;
        return weights;
      }

      for (const i of middleIndices) {
        weights[i] += middleWeight / middleIndices.length;
      }
      return weights;
    }

    default:
      return new Array(n).fill(1 / n);
  }
}

/**
 * Splits an integer amount by fractional weights without losing or inventing
 * minor units. The remainder goes to the largest-weighted positions, which is
 * both deterministic and the least surprising place for a stray cent.
 */
export function splitMinorUnits(
  totalMinor: number,
  weights: number[],
): number[] {
  if (weights.length === 0) return [];

  const raw = weights.map((w) => totalMinor * w);
  const floored = raw.map((v) => Math.floor(v));
  let remainder = totalMinor - floored.reduce((a, b) => a + b, 0);

  const order = raw
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);

  for (let i = 0; remainder > 0 && i < order.length; i++, remainder--) {
    floored[order[i].index] += 1;
  }

  return floored;
}

export function attributeConversion(
  conversion: Conversion,
  options: AttributionOptions,
): AttributedCredit[] {
  const touchpoints = eligibleTouchpoints(conversion, options);
  if (touchpoints.length === 0) return [];

  const weights = weightsFor(touchpoints, options);
  const amounts = splitMinorUnits(conversion.revenueMinor, weights);

  return touchpoints.map((tp, i) => ({
    conversionId: conversion.id,
    touchpointId: tp.id,
    channel: tp.channel,
    campaign: tp.campaign ?? null,
    creditFraction: weights[i],
    creditMinor: amounts[i],
  }));
}

export type ChannelAttribution = {
  channel: string;
  attributedRevenueMinor: number;
  attributedConversions: number;
  /** Conversions where this channel held 100% of the credit. */
  soleCreditConversions: number;
};

export function attributeByChannel(
  conversions: Conversion[],
  options: AttributionOptions,
): ChannelAttribution[] {
  const totals = new Map<string, ChannelAttribution>();

  for (const conversion of conversions) {
    const credits = attributeConversion(conversion, options);

    for (const credit of credits) {
      const existing = totals.get(credit.channel) ?? {
        channel: credit.channel,
        attributedRevenueMinor: 0,
        attributedConversions: 0,
        soleCreditConversions: 0,
      };

      existing.attributedRevenueMinor += credit.creditMinor;
      existing.attributedConversions += credit.creditFraction;
      if (credit.creditFraction === 1) existing.soleCreditConversions += 1;

      totals.set(credit.channel, existing);
    }
  }

  return [...totals.values()]
    .map((row) => ({
      ...row,
      attributedConversions:
        Math.round(row.attributedConversions * 100) / 100,
    }))
    .sort((a, b) => b.attributedRevenueMinor - a.attributedRevenueMinor);
}

/**
 * Attribution Confidence.
 *
 * Measures how much the models disagree about a channel. This is NOT a
 * statistical confidence interval and is never presented as one — it is a
 * transparency signal: when first- and last-touch tell different stories, any
 * single number is a choice, not a fact.
 *
 * Returned as the normalised spread across models, 0 (perfect agreement) to
 * 1 (total disagreement), plus a plain-language band.
 */
export type AttributionConfidence = {
  channel: string;
  disagreement: number;
  band: "HIGH" | "MEDIUM" | "LOW";
  perModelRevenueMinor: Record<AttributionModel, number>;
};

const COMPARED_MODELS: AttributionModel[] = [
  "FIRST_TOUCH",
  "LAST_TOUCH",
  "LINEAR",
  "U_SHAPED",
];

export function attributionConfidence(
  conversions: Conversion[],
  options: Omit<AttributionOptions, "model">,
): AttributionConfidence[] {
  const byModel = new Map<AttributionModel, Map<string, number>>();

  for (const model of COMPARED_MODELS) {
    const rows = attributeByChannel(conversions, { ...options, model });
    byModel.set(
      model,
      new Map(rows.map((r) => [r.channel, r.attributedRevenueMinor])),
    );
  }

  const channels = new Set<string>();
  for (const map of byModel.values()) {
    for (const channel of map.keys()) channels.add(channel);
  }

  return [...channels]
    .map((channel) => {
      const perModel = {} as Record<AttributionModel, number>;
      const values: number[] = [];

      for (const model of COMPARED_MODELS) {
        const value = byModel.get(model)?.get(channel) ?? 0;
        perModel[model] = value;
        values.push(value);
      }
      perModel.POSITION_BASED = perModel.U_SHAPED;

      const max = Math.max(...values);
      const min = Math.min(...values);
      const disagreement = max === 0 ? 0 : (max - min) / max;

      return {
        channel,
        disagreement: Math.round(disagreement * 1000) / 1000,
        band:
          disagreement < 0.2 ? "HIGH" : disagreement < 0.5 ? "MEDIUM" : "LOW",
        perModelRevenueMinor: perModel,
      } satisfies AttributionConfidence;
    })
    .sort((a, b) => b.disagreement - a.disagreement);
}
