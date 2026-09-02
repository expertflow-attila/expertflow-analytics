import { describe, expect, it } from "vitest";

import {
  attributeByChannel,
  attributeConversion,
  attributionConfidence,
  splitMinorUnits,
  type AttributionOptions,
  type Conversion,
} from "../attribution-core";

const DAY = 24 * 60 * 60 * 1000;
const T0 = Date.UTC(2026, 0, 1);

const baseOptions: Omit<AttributionOptions, "model"> = {
  windowDays: 90,
  includeDirect: true,
  includeOrganic: true,
};

/**
 * The specification's golden journey:
 *   Facebook → Email → YouTube → purchase of 100.00
 */
const journey: Conversion = {
  id: "conv1",
  personId: "p1",
  occurredAt: T0 + 10 * DAY,
  revenueMinor: 10_000,
  touchpoints: [
    { id: "t1", channel: "Facebook", occurredAt: T0 },
    { id: "t2", channel: "Email", occurredAt: T0 + DAY, isLeadConversion: true },
    { id: "t3", channel: "YouTube", occurredAt: T0 + 5 * DAY },
  ],
};

describe("attribution golden fixture", () => {
  it("first touch credits Facebook with the full 100.00", () => {
    const credits = attributeConversion(journey, {
      ...baseOptions,
      model: "FIRST_TOUCH",
    });
    expect(credits.find((c) => c.channel === "Facebook")?.creditMinor).toBe(10_000);
    expect(credits.find((c) => c.channel === "YouTube")?.creditMinor).toBe(0);
  });

  it("last touch credits YouTube with the full 100.00", () => {
    const credits = attributeConversion(journey, {
      ...baseOptions,
      model: "LAST_TOUCH",
    });
    expect(credits.find((c) => c.channel === "YouTube")?.creditMinor).toBe(10_000);
    expect(credits.find((c) => c.channel === "Facebook")?.creditMinor).toBe(0);
  });

  it("linear splits 33.33 / 33.33 / 33.34 with no lost cent", () => {
    const credits = attributeConversion(journey, {
      ...baseOptions,
      model: "LINEAR",
    });

    const amounts = credits.map((c) => c.creditMinor);
    expect(amounts).toEqual([3_334, 3_333, 3_333]);
    expect(amounts.reduce((a, b) => a + b, 0)).toBe(10_000);
  });

  it("u-shaped gives 40% first, 40% lead, 20% to the middle", () => {
    // Lead conversion is the second of three touchpoints, so the remaining
    // 20% goes entirely to YouTube.
    const credits = attributeConversion(journey, {
      ...baseOptions,
      model: "U_SHAPED",
    });

    const byChannel = Object.fromEntries(
      credits.map((c) => [c.channel, c.creditMinor]),
    );

    expect(byChannel.Facebook).toBe(4_000);
    expect(byChannel.Email).toBe(4_000);
    expect(byChannel.YouTube).toBe(2_000);
  });
});

describe("credit conservation", () => {
  it("always sums back to the exact conversion revenue", () => {
    const models = ["FIRST_TOUCH", "LAST_TOUCH", "LINEAR", "U_SHAPED"] as const;

    for (const model of models) {
      for (const revenue of [1, 7, 99, 100, 333, 10_000, 99_999]) {
        const credits = attributeConversion(
          { ...journey, revenueMinor: revenue },
          { ...baseOptions, model },
        );
        const total = credits.reduce((sum, c) => sum + c.creditMinor, 0);
        expect(total).toBe(revenue);
      }
    }
  });

  it("distributes remainders deterministically", () => {
    expect(splitMinorUnits(10, [1 / 3, 1 / 3, 1 / 3])).toEqual([4, 3, 3]);
    expect(splitMinorUnits(100, [0.5, 0.5])).toEqual([50, 50]);
    expect(splitMinorUnits(1, [0.4, 0.4, 0.2])).toEqual([1, 0, 0]);
  });
});

describe("attribution window and filters", () => {
  it("ignores touchpoints older than the window", () => {
    const credits = attributeConversion(journey, {
      ...baseOptions,
      model: "FIRST_TOUCH",
      windowDays: 7,
    });

    // Facebook at T0 is 10 days before the conversion, so YouTube becomes first.
    expect(credits[0].channel).toBe("YouTube");
  });

  it("can exclude direct and unknown touchpoints", () => {
    const withDirect: Conversion = {
      ...journey,
      touchpoints: [
        { id: "t0", channel: "Direct", occurredAt: T0 - DAY },
        ...journey.touchpoints,
      ],
    };

    const included = attributeConversion(withDirect, {
      ...baseOptions,
      model: "FIRST_TOUCH",
    });
    expect(included[0].channel).toBe("Direct");

    const excluded = attributeConversion(withDirect, {
      ...baseOptions,
      model: "FIRST_TOUCH",
      includeDirect: false,
    });
    expect(excluded[0].channel).toBe("Facebook");
  });

  it("returns no credit when a conversion has no eligible touchpoint", () => {
    const orphan: Conversion = { ...journey, touchpoints: [] };
    expect(
      attributeConversion(orphan, { ...baseOptions, model: "LINEAR" }),
    ).toEqual([]);
  });
});

describe("channel roll-up", () => {
  it("aggregates credit across conversions", () => {
    const rows = attributeByChannel([journey, { ...journey, id: "conv2" }], {
      ...baseOptions,
      model: "LINEAR",
    });

    const facebook = rows.find((r) => r.channel === "Facebook");
    expect(facebook?.attributedRevenueMinor).toBe(6_668);
    expect(facebook?.attributedConversions).toBeCloseTo(0.67, 2);
  });
});

describe("attribution confidence", () => {
  it("reports LOW confidence when models disagree sharply", () => {
    const rows = attributionConfidence([journey], baseOptions);
    const facebook = rows.find((r) => r.channel === "Facebook");

    // First-touch gives Facebook everything, last-touch gives it nothing.
    expect(facebook?.disagreement).toBe(1);
    expect(facebook?.band).toBe("LOW");
  });

  it("reports HIGH confidence for single-touch journeys", () => {
    const single: Conversion = {
      ...journey,
      touchpoints: [{ id: "t1", channel: "Email", occurredAt: T0 }],
    };

    const rows = attributionConfidence([single], baseOptions);
    expect(rows[0].band).toBe("HIGH");
    expect(rows[0].disagreement).toBe(0);
  });
});
