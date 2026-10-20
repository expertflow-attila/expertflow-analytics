import { formatPercent } from "../utils";
/**
 * Anomaly detection — pure core.
 *
 * Rolling mean plus standard deviation, with a day-of-week baseline when there
 * is enough history. No machine learning: with the data volumes a typical
 * consulting or course business produces, a statistical baseline is both more
 * honest and more explainable than a model nobody can interrogate.
 */

export type MetricPoint = { date: string; value: number };

export type Anomaly = {
  date: string;
  metric: string;
  observed: number;
  expected: number;
  deviationSigma: number;
  changeFraction: number;
  direction: "SPIKE" | "DROP";
  severity: "INFO" | "WARNING" | "CRITICAL";
};

export type AnomalyOptions = {
  /** Days of history used to build the baseline. */
  lookbackDays?: number;
  /** Minimum |z| before a point is reported. */
  sigmaThreshold?: number;
  /** Minimum relative change, so tiny absolute moves stay quiet. */
  minChangeFraction?: number;
  /** Below this many baseline points, detection is skipped entirely. */
  minBaselinePoints?: number;
  /** Minimum same-weekday points before the seasonal baseline is used. */
  minSeasonalPoints?: number;
  /** Compare each day against the same weekday when history allows. */
  seasonalityAware?: boolean;
};

function meanAndStdDev(values: number[]): { mean: number; stdDev: number } {
  if (values.length === 0) return { mean: 0, stdDev: 0 };
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return { mean, stdDev: Math.sqrt(variance) };
}

function weekdayOf(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

export function detectAnomalies(
  metric: string,
  series: MetricPoint[],
  options: AnomalyOptions = {},
): Anomaly[] {
  const {
    lookbackDays = 28,
    sigmaThreshold = 2.5,
    minChangeFraction = 0.15,
    minBaselinePoints = 7,
    minSeasonalPoints = 3,
    seasonalityAware = true,
  } = options;

  const sorted = [...series].sort((a, b) => a.date.localeCompare(b.date));
  const anomalies: Anomaly[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const point = sorted[i];
    const historyStart = Math.max(0, i - lookbackDays);
    const history = sorted.slice(historyStart, i);

    // The sufficiency check runs against the FULL history, before any
    // narrowing. Applying it after the weekday filter would be self-defeating:
    // a 28 day lookback holds at most four of any given weekday, so demanding
    // seven would silently switch detection off for every series long enough
    // to have seasonality in the first place.
    if (history.length < minBaselinePoints) continue;

    let baseline = history;

    if (seasonalityAware && history.length >= 21) {
      const sameWeekday = history.filter(
        (p) => weekdayOf(p.date) === weekdayOf(point.date),
      );
      // A weekday baseline needs fewer points to be meaningful, but not so few
      // that one outlier defines "normal".
      if (sameWeekday.length >= minSeasonalPoints) baseline = sameWeekday;
    }

    const { mean, stdDev } = meanAndStdDev(baseline.map((p) => p.value));
    if (mean === 0) continue;

    const changeFraction = (point.value - mean) / mean;
    if (Math.abs(changeFraction) < minChangeFraction) continue;

    // A flat baseline has no meaningful sigma; fall back to relative change
    // rather than reporting an infinite z-score.
    const sigma =
      stdDev === 0
        ? Math.abs(changeFraction) >= minChangeFraction
          ? sigmaThreshold
          : 0
        : (point.value - mean) / stdDev;

    if (Math.abs(sigma) < sigmaThreshold) continue;

    const magnitude = Math.abs(changeFraction);

    anomalies.push({
      date: point.date,
      metric,
      observed: point.value,
      expected: Math.round(mean * 100) / 100,
      deviationSigma: Math.round(sigma * 100) / 100,
      changeFraction: Math.round(changeFraction * 1000) / 1000,
      direction: changeFraction > 0 ? "SPIKE" : "DROP",
      severity:
        magnitude >= 0.5 ? "CRITICAL" : magnitude >= 0.25 ? "WARNING" : "INFO",
    });
  }

  return anomalies;
}

/**
 * Tracking Health.
 *
 * A single 0–100 score plus the checks behind it. The score exists so the UI
 * can refuse to present confident insights on top of broken data.
 */
export type HealthCheck = {
  key: string;
  label: string;
  status: "PASS" | "WARN" | "FAIL";
  value: number;
  detail: string;
  recommendation: string;
  /** How much of the 100-point budget this check can remove. */
  weight: number;
};

export type TrackingHealthInput = {
  totalEvents: number;
  duplicateEvents: number;
  eventsWithoutIdentity: number;
  sessionsWithUnknownSource: number;
  totalSessions: number;
  purchasesWithoutPerson: number;
  totalPurchases: number;
  unmatchedStripeCustomers: number;
  ingestErrors: number;
  ingestRequests: number;
  eventsMissingUtmOnPaid: number;
  paidEvents: number;
};

export function calculateTrackingHealth(input: TrackingHealthInput): {
  /** Null when there is not enough data to judge. Never a default of 100. */
  score: number | null;
  unavailableReason: string | null;
  checks: HealthCheck[];
} {
  // Every check is a ratio, and every ratio over zero events is zero, which
  // would make an empty project score a perfect 100. Reporting confidence in
  // data that does not exist is the exact failure this score exists to catch.
  if (input.totalEvents === 0) {
    return {
      score: null,
      unavailableReason:
        "Még nem érkeztek események, ezért az adatminőség nem mérhető.",
      checks: [],
    };
  }

  const safeRatio = (numerator: number, denominator: number) =>
    denominator === 0 ? 0 : numerator / denominator;

  const checks: HealthCheck[] = [
    buildCheck({
      key: "duplicate_events",
      label: "Duplikált események",
      value: safeRatio(input.duplicateEvents, input.totalEvents),
      warnAt: 0.02,
      failAt: 0.1,
      weight: 15,
      detail: (v) =>
        `A beérkezett események ${formatPercent(v)} része duplikált.`,
      recommendation:
        "Minden esemény kapjon stabil event_id azonosítót, és a mérőkód oldalanként csak egyszer töltődjön be.",
    }),
    buildCheck({
      key: "unknown_source",
      label: "Ismeretlen forgalmi forrás",
      value: safeRatio(input.sessionsWithUnknownSource, input.totalSessions),
      warnAt: 0.1,
      failAt: 0.3,
      weight: 20,
      detail: (v) =>
        `A munkamenetek ${formatPercent(v)} részének nincs azonosítható forrása.`,
      recommendation:
        "Adj UTM-paramétereket a hirdetési és e-mailes linkekhez, és ellenőrizd, hogy az átirányítás nem törli-e a hivatkozó oldalt.",
    }),
    buildCheck({
      key: "purchase_reconciliation",
      label: "Vásárlások egyeztetése",
      value: safeRatio(input.purchasesWithoutPerson, input.totalPurchases),
      warnAt: 0.02,
      failAt: 0.1,
      weight: 25,
      detail: (v) =>
        `A vásárlások ${formatPercent(v)} részét nem sikerült személyhez kapcsolni.`,
      recommendation:
        "Hívd meg a funnel.identify() függvényt a vásárló e-mail-címével legkésőbb a pénztárnál, hogy a bevétel az ügyfélúthoz kapcsolódjon.",
    }),
    buildCheck({
      key: "identity_coverage",
      label: "Azonosítási arány",
      value: safeRatio(input.eventsWithoutIdentity, input.totalEvents),
      warnAt: 0.7,
      failAt: 0.9,
      weight: 15,
      detail: (v) => `Az események ${formatPercent(v)} része még anonim.`,
      recommendation:
        "Az első űrlapbeküldéskor azonosítsd a látogatót, hogy korábbi anonim aktivitása is hozzákapcsolódjon.",
    }),
    buildCheck({
      key: "ingest_errors",
      label: "Adatfogadási hibák",
      value: safeRatio(input.ingestErrors, input.ingestRequests),
      warnAt: 0.01,
      failAt: 0.05,
      weight: 15,
      detail: (v) =>
        `Az adatfogadási kérések ${formatPercent(v, 2)} része sikertelen.`,
      recommendation:
        "Az Integrációk oldalon keresd meg a hibás forrást, és ellenőrizd a beküldött adatok legutóbbi változásait.",
    }),
    buildCheck({
      key: "paid_utm_coverage",
      label: "Fizetett forgalom UTM-lefedettsége",
      value: safeRatio(input.eventsMissingUtmOnPaid, input.paidEvents),
      warnAt: 0.05,
      failAt: 0.2,
      weight: 10,
      detail: (v) =>
        `A fizetett események ${formatPercent(v)} része kampányjelölés nélkül érkezett.`,
      recommendation:
        "Kapcsold be az automatikus címkézést a hirdetési felületen, vagy adj utm_campaign paramétert minden hirdetési céloldalhoz.",
    }),
  ];

  const penalty = checks.reduce((sum, check) => {
    if (check.status === "FAIL") return sum + check.weight;
    if (check.status === "WARN") return sum + check.weight * 0.5;
    return sum;
  }, 0);

  return {
    score: Math.max(0, Math.round(100 - penalty)),
    unavailableReason: null,
    checks,
  };
}

function buildCheck(spec: {
  key: string;
  label: string;
  value: number;
  warnAt: number;
  failAt: number;
  weight: number;
  detail: (value: number) => string;
  recommendation: string;
}): HealthCheck {
  const status =
    spec.value >= spec.failAt
      ? "FAIL"
      : spec.value >= spec.warnAt
        ? "WARN"
        : "PASS";

  return {
    key: spec.key,
    label: spec.label,
    status,
    value: Math.round(spec.value * 10000) / 10000,
    detail: spec.detail(spec.value),
    recommendation: spec.recommendation,
    weight: spec.weight,
  };
}
