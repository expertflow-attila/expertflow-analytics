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
    seasonalityAware = true,
  } = options;

  const sorted = [...series].sort((a, b) => a.date.localeCompare(b.date));
  const anomalies: Anomaly[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const point = sorted[i];
    const historyStart = Math.max(0, i - lookbackDays);
    let baseline = sorted.slice(historyStart, i);

    if (seasonalityAware && baseline.length >= 21) {
      const sameWeekday = baseline.filter(
        (p) => weekdayOf(p.date) === weekdayOf(point.date),
      );
      // Only switch to the weekday baseline when it is itself substantial.
      if (sameWeekday.length >= 3) baseline = sameWeekday;
    }

    if (baseline.length < minBaselinePoints) continue;

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
  score: number;
  checks: HealthCheck[];
} {
  const safeRatio = (numerator: number, denominator: number) =>
    denominator === 0 ? 0 : numerator / denominator;

  const checks: HealthCheck[] = [
    buildCheck({
      key: "duplicate_events",
      label: "Duplicate events",
      value: safeRatio(input.duplicateEvents, input.totalEvents),
      warnAt: 0.02,
      failAt: 0.1,
      weight: 15,
      detail: (v) => `${(v * 100).toFixed(1)}% of received events were duplicates.`,
      recommendation:
        "Ensure every event carries a stable event_id and that the SDK is loaded once per page.",
    }),
    buildCheck({
      key: "unknown_source",
      label: "Unknown traffic source",
      value: safeRatio(input.sessionsWithUnknownSource, input.totalSessions),
      warnAt: 0.1,
      failAt: 0.3,
      weight: 20,
      detail: (v) => `${(v * 100).toFixed(1)}% of sessions have no identifiable source.`,
      recommendation:
        "Add UTM parameters to paid and email links, and verify the referrer is not stripped by a redirect.",
    }),
    buildCheck({
      key: "purchase_reconciliation",
      label: "Purchase reconciliation",
      value: safeRatio(input.purchasesWithoutPerson, input.totalPurchases),
      warnAt: 0.02,
      failAt: 0.1,
      weight: 25,
      detail: (v) => `${(v * 100).toFixed(1)}% of purchases could not be matched to a person.`,
      recommendation:
        "Call funnel.identify() with the buyer's email before or at checkout so revenue joins the journey.",
    }),
    buildCheck({
      key: "identity_coverage",
      label: "Identity coverage",
      value: safeRatio(input.eventsWithoutIdentity, input.totalEvents),
      warnAt: 0.7,
      failAt: 0.9,
      weight: 15,
      detail: (v) => `${(v * 100).toFixed(1)}% of events are still anonymous.`,
      recommendation:
        "Identify people at the first form submission so earlier anonymous activity can be back-filled.",
    }),
    buildCheck({
      key: "ingest_errors",
      label: "Ingest errors",
      value: safeRatio(input.ingestErrors, input.ingestRequests),
      warnAt: 0.01,
      failAt: 0.05,
      weight: 15,
      detail: (v) => `${(v * 100).toFixed(2)}% of ingest requests failed.`,
      recommendation:
        "Check the Integrations page for the failing source and review recent payload changes.",
    }),
    buildCheck({
      key: "paid_utm_coverage",
      label: "UTM coverage on paid traffic",
      value: safeRatio(input.eventsMissingUtmOnPaid, input.paidEvents),
      warnAt: 0.05,
      failAt: 0.2,
      weight: 10,
      detail: (v) => `${(v * 100).toFixed(1)}% of paid events arrived without campaign tags.`,
      recommendation:
        "Enable auto-tagging on the ad platform or add utm_campaign to every ad destination URL.",
    }),
  ];

  const penalty = checks.reduce((sum, check) => {
    if (check.status === "FAIL") return sum + check.weight;
    if (check.status === "WARN") return sum + check.weight * 0.5;
    return sum;
  }, 0);

  return { score: Math.max(0, Math.round(100 - penalty)), checks };
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
