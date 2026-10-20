import { describe, expect, it } from "vitest";

import {
  calculateTrackingHealth,
  detectAnomalies,
  type TrackingHealthInput,
} from "../anomaly-core";

const HEALTHY: TrackingHealthInput = {
  totalEvents: 100_000,
  duplicateEvents: 100,
  eventsWithoutIdentity: 40_000,
  sessionsWithUnknownSource: 500,
  totalSessions: 20_000,
  purchasesWithoutPerson: 0,
  totalPurchases: 200,
  unmatchedStripeCustomers: 0,
  ingestErrors: 0,
  ingestRequests: 5_000,
  eventsMissingUtmOnPaid: 0,
  paidEvents: 10_000,
};

describe("tracking health", () => {
  it("refuses to score a project with no events", () => {
    const result = calculateTrackingHealth({ ...HEALTHY, totalEvents: 0 });

    // Every check is a ratio, and every ratio over zero is zero, so a naive
    // implementation awards a perfect score to a project holding no data.
    expect(result.score).toBeNull();
    expect(result.unavailableReason).toMatch(/nem érkeztek események/i);
    expect(result.checks).toHaveLength(0);
  });

  it("scores a clean dataset highly", () => {
    const result = calculateTrackingHealth(HEALTHY);
    expect(result.score).toBeGreaterThanOrEqual(85);
    expect(result.unavailableReason).toBeNull();
    expect(result.checks.every((check) => check.status === "PASS")).toBe(true);
  });

  it("penalises unreconciled purchases most heavily", () => {
    const result = calculateTrackingHealth({
      ...HEALTHY,
      purchasesWithoutPerson: 40,
    });

    const check = result.checks.find(
      (c) => c.key === "purchase_reconciliation",
    );
    expect(check?.status).toBe("FAIL");
    expect(result.score).toBe(75);
  });

  it("names a fix for every check that is not passing", () => {
    const result = calculateTrackingHealth({
      ...HEALTHY,
      sessionsWithUnknownSource: 12_000,
      duplicateEvents: 30_000,
    });

    for (const check of result.checks) {
      if (check.status === "PASS") continue;
      expect(check.recommendation.length).toBeGreaterThan(20);
      expect(check.detail).toMatch(/%/);
    }
  });
});

describe("anomaly detection", () => {
  /** A steady series with a known spike on the final day. */
  function series(values: number[], start = "2026-01-01") {
    const from = new Date(`${start}T00:00:00Z`).getTime();
    return values.map((value, index) => ({
      date: new Date(from + index * 86_400_000).toISOString().slice(0, 10),
      value,
    }));
  }

  it("stays silent on a stable series", () => {
    const stable = series(Array.from({ length: 40 }, () => 100));
    expect(detectAnomalies("revenue", stable)).toHaveLength(0);
  });

  it("reports a large, statistically unusual drop", () => {
    const values = Array.from({ length: 40 }, (_, i) => 100 + (i % 5));
    values[39] = 20;

    const found = detectAnomalies("revenue", series(values));
    expect(found).toHaveLength(1);
    expect(found[0].direction).toBe("DROP");
    expect(found[0].severity).toBe("CRITICAL");
  });

  it("ignores a large move that sits within normal variance", () => {
    // Swings between 50 and 150 every day; another 150 is not news.
    const values = Array.from({ length: 40 }, (_, i) =>
      i % 2 === 0 ? 50 : 150,
    );
    values[39] = 150;

    expect(detectAnomalies("revenue", series(values))).toHaveLength(0);
  });

  it("ignores a statistically unusual but trivially small move", () => {
    const values = Array.from({ length: 40 }, () => 100);
    values[39] = 105;

    // 5% is outside a flat baseline but far too small to be worth a warning.
    expect(detectAnomalies("revenue", series(values))).toHaveLength(0);
  });

  it("does not report before enough history exists", () => {
    const values = [100, 100, 10];
    expect(detectAnomalies("revenue", series(values))).toHaveLength(0);
  });

  it("compares against the same weekday when history allows", () => {
    // Weekdays 100, weekends 20. A weekend at 20 must not be an anomaly.
    const values = Array.from({ length: 60 }, (_, i) => {
      const day = new Date(
        new Date("2026-01-01T00:00:00Z").getTime() + i * 86_400_000,
      ).getUTCDay();
      return day === 0 || day === 6 ? 20 : 100;
    });

    const found = detectAnomalies("visitors", series(values));
    expect(found).toHaveLength(0);
  });
});
