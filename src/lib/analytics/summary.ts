import type { Opportunity } from "./opportunity-core";

/**
 * Executive summary, generated deterministically from computed metrics.
 *
 * Template-based on purpose: the whole product works without AI, and a summary
 * that only appears when an LLM is configured is not a summary anyone can rely
 * on. When AI is enabled it rephrases this text — it never sources the numbers.
 */
export type SummaryInput = {
  currency: string;
  netRevenueMinor: number;
  previousNetRevenueMinor: number | null;
  topChannel: { name: string; revenueMinor: number } | null;
  biggestOpportunity: Opportunity | null;
  trackingHealthScore: number;
  locale?: string;
};

function money(minor: number, currency: string, locale = "en-US"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(minor / 100);
}

export function buildExecutiveSummary(input: SummaryInput): string[] {
  const { currency, locale = "en-US" } = input;
  const sentences: string[] = [];

  if (
    input.previousNetRevenueMinor !== null &&
    input.previousNetRevenueMinor > 0
  ) {
    const change =
      (input.netRevenueMinor - input.previousNetRevenueMinor) /
      input.previousNetRevenueMinor;
    const direction = change >= 0 ? "up" : "down";

    sentences.push(
      `Net revenue is ${direction} ${Math.abs(change * 100).toFixed(1)}% on the previous period, at ${money(input.netRevenueMinor, currency, locale)}.`,
    );
  } else {
    sentences.push(
      `Net revenue for this period is ${money(input.netRevenueMinor, currency, locale)}.`,
    );
  }

  if (input.topChannel) {
    sentences.push(
      `The strongest contributor is ${input.topChannel.name}, credited with ${money(input.topChannel.revenueMinor, currency, locale)}.`,
    );
  }

  const opportunity = input.biggestOpportunity;
  if (opportunity && opportunity.confidence !== "UNAVAILABLE") {
    sentences.push(
      `The largest current opportunity is ${opportunity.nodeName}. Moving it from ` +
        `${(opportunity.currentConversionRate * 100).toFixed(1)}% to ` +
        `${(opportunity.targetConversionRate * 100).toFixed(1)}% would generate an estimated ` +
        `${money(opportunity.estimatedMonthlyUpsideMinor, currency, locale)} of additional monthly revenue ` +
        `(${opportunity.confidence.toLowerCase()} confidence).`,
    );
  }

  // The caveat comes last and is never omitted — a summary built on weak data
  // that does not say so is worse than no summary.
  if (input.trackingHealthScore < 85) {
    sentences.push(
      `Tracking health is ${input.trackingHealthScore}/100, so treat the channel figures above as indicative rather than exact.`,
    );
  }

  return sentences;
}
