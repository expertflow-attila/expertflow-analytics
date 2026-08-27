import { describe, expect, it } from "vitest";
import { attributeRevenue, calculateOpportunity, rate, simulateRevenue } from "./analytics";

describe("analytics golden fixtures", () => {
  it("calculates the documented strict funnel fixture", () => {
    expect(rate(4, 10)).toBe(40);
    expect(rate(2, 4)).toBe(50);
    expect(rate(1, 2)).toBe(50);
  });

  it("uses deterministic attribution rounding", () => {
    const touches = [{ channel: "Facebook" }, { channel: "Email" }, { channel: "YouTube" }];
    expect(attributeRevenue(touches, 100, "first")).toEqual([{ channel: "Facebook", revenue: 100 }, { channel: "Email", revenue: 0 }, { channel: "YouTube", revenue: 0 }]);
    expect(attributeRevenue(touches, 100, "last")).toEqual([{ channel: "Facebook", revenue: 0 }, { channel: "Email", revenue: 0 }, { channel: "YouTube", revenue: 100 }]);
    expect(attributeRevenue(touches, 100, "linear")).toEqual([{ channel: "Facebook", revenue: 33.33 }, { channel: "Email", revenue: 33.33 }, { channel: "YouTube", revenue: 33.34 }]);
  });

  it("calculates opportunity value from rate improvement", () => {
    const result = calculateOpportunity({ eligibleUsers: 1000, currentRate: 8, targetRate: 11, downstreamRevenuePerConversion: 600, confidence: 0.8, effort: 2 });
    expect(result.additionalConversions).toBeCloseTo(30);
    expect(result.monthlyUpside).toBeCloseTo(18000);
  });

  it("recalculates a scenario without an LLM", () => {
    const result = simulateRevenue({ traffic: 10000, leadRate: 5, bookingRate: 10, closeRate: 20, averageOrderValue: 2000, adSpend: 10000 });
    expect(result.customers).toBe(10);
    expect(result.revenue).toBe(20000);
    expect(result.roas).toBe(2);
  });
});
