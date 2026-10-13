import { describe, expect, it } from "vitest";
import { buildDailyAggregates, fillMissingDays } from "./aggregates";

describe("daily aggregates", () => {
  it("groups events by day", () => {
    const events = [
      { timestamp: "2026-10-01T10:00:00Z", event_name: "pageview", person_id: "p1" },
      { timestamp: "2026-10-01T11:00:00Z", event_name: "purchase", person_id: "p1", properties: { revenue: 100 } },
      { timestamp: "2026-10-02T09:00:00Z", event_name: "pageview", person_id: "p2" }
    ];
    const aggs = buildDailyAggregates(events);
    expect(aggs).toHaveLength(2);
    expect(aggs[0].pageviews).toBe(1);
    expect(aggs[0].revenue).toBe(100);
    expect(aggs[1].pageviews).toBe(1);
  });

  it("fills missing days with zeros", () => {
    const filled = fillMissingDays(
      [{ date: "2026-10-01", pageviews: 5, visitors: 2, sessions: 1, revenue: 0 }],
      "2026-10-01",
      "2026-10-03"
    );
    expect(filled).toHaveLength(3);
    expect(filled[1].pageviews).toBe(0);
    expect(filled[2].date).toBe("2026-10-03");
  });
});
