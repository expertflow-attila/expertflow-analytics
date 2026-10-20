import { formatPercent } from "../utils";
import { displayLabel } from "../labels";
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
  /** Null when there is no data to assess; the caveat is then omitted. */
  trackingHealthScore: number | null;
  locale?: string;
};

function money(minor: number, currency: string, locale = "hu-HU"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(minor / 100);
}

export function buildExecutiveSummary(input: SummaryInput): string[] {
  const { currency, locale = "hu-HU" } = input;
  const sentences: string[] = [];

  if (
    input.previousNetRevenueMinor !== null &&
    input.previousNetRevenueMinor > 0
  ) {
    const change =
      (input.netRevenueMinor - input.previousNetRevenueMinor) /
      input.previousNetRevenueMinor;
    const direction = change >= 0 ? "nőtt" : "csökkent";

    sentences.push(
      `A nettó bevétel ${formatPercent(Math.abs(change))} mértékben ${direction} az előző időszakhoz képest, jelenlegi értéke ${money(input.netRevenueMinor, currency, locale)}.`,
    );
  } else {
    sentences.push(
      `Az időszak nettó bevétele ${money(input.netRevenueMinor, currency, locale)}.`,
    );
  }

  if (input.topChannel) {
    sentences.push(
      `A legtöbb hozzárendelt bevételt hozó csatorna: ${displayLabel(input.topChannel.name)}, értéke ${money(input.topChannel.revenueMinor, currency, locale)}.`,
    );
  }

  const opportunity = input.biggestOpportunity;
  if (opportunity && opportunity.confidence !== "UNAVAILABLE") {
    sentences.push(
      `A legnagyobb jelenlegi lehetőség: ${opportunity.nodeName}. A konverzió ${formatPercent(opportunity.currentConversionRate)} értékről ${formatPercent(opportunity.targetConversionRate)} értékre javítása becslésünk szerint havi ${money(opportunity.estimatedMonthlyUpsideMinor, currency, locale)} többletbevételt jelentene (${displayLabel(opportunity.confidence).toLocaleLowerCase("hu-HU")} megbízhatóság).`,
    );
  }

  // The caveat comes last and is never omitted — a summary built on weak data
  // that does not say so is worse than no summary.
  if (input.trackingHealthScore !== null && input.trackingHealthScore < 85) {
    sentences.push(
      `A mérés minősége ${input.trackingHealthScore}/100, ezért a csatornák értékeit tájékoztató jellegűként kezeld.`,
    );
  }

  return sentences;
}
