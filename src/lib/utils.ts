import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Money is stored and computed in minor units (cents) throughout the system —
 * floating-point currency arithmetic is never allowed to reach the database.
 * Formatting is the only place a division by 100 happens.
 */
export function formatCurrency(
  minorUnits: number | null | undefined,
  currency: string,
  options: { compact?: boolean; locale?: string } = {},
): string {
  if (minorUnits === null || minorUnits === undefined) return "—";
  const { compact = false, locale = "hu-HU" } = options;

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : 2,
    minimumFractionDigits: compact ? 0 : 2,
  }).format(minorUnits / 100);
}

export function formatNumber(
  value: number | null | undefined,
  options: { compact?: boolean; locale?: string } = {},
): string {
  if (value === null || value === undefined) return "—";
  const { compact = false, locale = "hu-HU" } = options;

  return new Intl.NumberFormat(locale, {
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : 0,
  }).format(value);
}

/** Rates are held as fractions (0.318) and rendered as percentages (31.8%). */
export function formatPercent(
  value: number | null | undefined,
  digits = 1,
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("hu-HU", {
    style: "percent",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

/**
 * Percentage-point delta, the correct unit when comparing two rates.
 * Confusing this with a relative percentage change is one of the most common
 * ways analytics UIs mislead people.
 */
export function formatPointDelta(
  value: number | null | undefined,
  digits = 1,
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatDecimal(value * 100, digits)} százalékpont`;
}

export function formatRelativeChange(
  current: number | null | undefined,
  previous: number | null | undefined,
): { value: number | null; label: string } {
  if (
    current === null ||
    current === undefined ||
    previous === null ||
    previous === undefined ||
    previous === 0
  ) {
    return { value: null, label: "—" };
  }
  const change = (current - previous) / previous;
  const sign = change > 0 ? "+" : "";
  return { value: change, label: `${sign}${formatPercent(change)}` };
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return "—";
  if (seconds < 60) return `${Math.round(seconds)} mp`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} perc`;
  if (seconds < 86400) return `${formatDecimal(seconds / 3600)} óra`;
  return `${formatDecimal(seconds / 86400)} nap`;
}

export function formatDecimal(value: number, digits = 1): string {
  return new Intl.NumberFormat("hu-HU", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatDate(value: Date | string, timeZone = "Europe/Budapest"): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("hu-HU", { dateStyle: "medium", timeZone }).format(date);
}
