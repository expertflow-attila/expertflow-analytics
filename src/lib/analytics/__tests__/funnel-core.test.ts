import { describe, expect, it } from "vitest";

import {
  calculateEdges,
  calculateFunnel,
  type ActorStream,
  type NodeSpec,
} from "../funnel-core";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const T0 = Date.UTC(2026, 0, 1);

function actor(id: string, events: Array<[string, number, number?]>): ActorStream {
  return {
    actorId: id,
    events: events.map(([eventName, offset, revenue]) => ({
      eventName,
      timestamp: T0 + offset,
      revenueMinor: revenue ?? null,
    })),
  };
}

const NODES: NodeSpec[] = [
  { id: "n1", name: "Landing page", eventName: "page_view" },
  { id: "n2", name: "Lead", eventName: "lead_created" },
  { id: "n3", name: "Call booked", eventName: "call_booked" },
  { id: "n4", name: "Purchase", eventName: "purchase_completed" },
];

describe("funnel golden fixture", () => {
  /**
   * The fixture from the specification:
   *   10 visitors → 8 reach the lead page → 4 become leads → 2 book a call
   *   → 1 buys for 1000.00
   *
   * Expected: 40% visitor→lead, 50% lead→call, 50% call→purchase.
   */
  const actors: ActorStream[] = [
    // 4 leads, of which 2 book, of which 1 buys
    actor("a1", [
      ["page_view", 0],
      ["lead_created", HOUR],
      ["call_booked", 2 * HOUR],
      ["purchase_completed", 3 * HOUR, 100_000],
    ]),
    actor("a2", [
      ["page_view", 0],
      ["lead_created", HOUR],
      ["call_booked", 2 * HOUR],
    ]),
    actor("a3", [
      ["page_view", 0],
      ["lead_created", HOUR],
    ]),
    actor("a4", [
      ["page_view", 0],
      ["lead_created", HOUR],
    ]),
    // 6 more visitors who never became leads
    ...Array.from({ length: 6 }, (_, i) =>
      actor(`v${i}`, [["page_view", 0]]),
    ),
  ];

  const result = calculateFunnel(NODES, actors, {
    mode: "ORDERED",
    conversionWindowSeconds: 30 * 24 * 60 * 60,
  });

  it("counts 10 visitors entering the first node", () => {
    expect(result.nodes[0].entered).toBe(10);
  });

  it("computes visitor to lead conversion as 40%", () => {
    expect(result.nodes[0].conversionRate).toBeCloseTo(0.4, 10);
  });

  it("computes lead to call conversion as 50%", () => {
    expect(result.nodes[1].entered).toBe(4);
    expect(result.nodes[1].conversionRate).toBeCloseTo(0.5, 10);
  });

  it("computes call to purchase conversion as 50%", () => {
    expect(result.nodes[2].entered).toBe(2);
    expect(result.nodes[2].conversionRate).toBeCloseTo(0.5, 10);
  });

  it("totals revenue at 1000.00", () => {
    expect(result.totalRevenueMinor).toBe(100_000);
  });

  it("reports overall conversion of 10%", () => {
    expect(result.overallConversionRate).toBeCloseTo(0.1, 10);
  });

  it("leaves the final node with no drop-off", () => {
    const last = result.nodes[result.nodes.length - 1];
    expect(last.dropoff).toBe(0);
    expect(last.conversionRate).toBeNull();
  });

  it("derives edges that agree with node metrics", () => {
    const edges = calculateEdges(result);
    expect(edges).toHaveLength(3);
    expect(edges[0].transitions).toBe(4);
    expect(edges[0].conversionRate).toBeCloseTo(0.4, 10);
    expect(edges[2].transitions).toBe(1);
  });
});

describe("counting rules", () => {
  it("counts each actor once per node regardless of repeat events", () => {
    const actors = [
      actor("a1", [
        ["page_view", 0],
        ["page_view", HOUR],
        ["page_view", 2 * HOUR],
        ["lead_created", 3 * HOUR],
      ]),
    ];

    const result = calculateFunnel(NODES.slice(0, 2), actors, {
      mode: "ORDERED",
      conversionWindowSeconds: DAY / 1000,
    });

    expect(result.nodes[0].entered).toBe(1);
    expect(result.nodes[1].entered).toBe(1);
    expect(result.nodes[0].conversionRate).toBe(1);
  });

  it("excludes conversions that fall outside the window", () => {
    const actors = [
      actor("a1", [
        ["page_view", 0],
        ["lead_created", 10 * DAY],
      ]),
    ];

    const result = calculateFunnel(NODES.slice(0, 2), actors, {
      mode: "ORDERED",
      conversionWindowSeconds: 7 * 24 * 60 * 60,
    });

    expect(result.nodes[0].entered).toBe(1);
    expect(result.nodes[1].entered).toBe(0);
    expect(result.nodes[0].conversionRate).toBe(0);
  });

  it("anchors the window on entry into the first node, not each step", () => {
    // Each hop is inside 7 days, but the whole journey spans 12 days.
    const actors = [
      actor("a1", [
        ["page_view", 0],
        ["lead_created", 6 * DAY],
        ["call_booked", 12 * DAY],
      ]),
    ];

    const result = calculateFunnel(NODES.slice(0, 3), actors, {
      mode: "ORDERED",
      conversionWindowSeconds: 7 * 24 * 60 * 60,
    });

    expect(result.nodes[1].entered).toBe(1);
    expect(result.nodes[2].entered).toBe(0);
  });
});

describe("funnel modes", () => {
  const strictNodes: NodeSpec[] = [
    { id: "n1", name: "Page", eventName: "page_view" },
    { id: "n2", name: "Lead", eventName: "lead_created" },
  ];

  const withDetour = [
    actor("a1", [
      ["page_view", 0],
      ["email_clicked", HOUR],
      ["lead_created", 2 * HOUR],
    ]),
  ];

  it("STRICT rejects a journey with an intervening event", () => {
    const result = calculateFunnel(strictNodes, withDetour, {
      mode: "STRICT",
      conversionWindowSeconds: DAY / 1000,
    });
    expect(result.nodes[1].entered).toBe(0);
  });

  it("ORDERED accepts a journey with an intervening event", () => {
    const result = calculateFunnel(strictNodes, withDetour, {
      mode: "ORDERED",
      conversionWindowSeconds: DAY / 1000,
    });
    expect(result.nodes[1].entered).toBe(1);
  });
});

describe("filters", () => {
  it("matches only events satisfying every filter", () => {
    const nodes: NodeSpec[] = [
      {
        id: "n1",
        name: "Pricing page",
        eventName: "page_view",
        filters: [{ field: "path", op: "eq", value: "/pricing" }],
      },
    ];

    const actors: ActorStream[] = [
      {
        actorId: "a1",
        events: [
          { eventName: "page_view", timestamp: T0, attributes: { path: "/" } },
          {
            eventName: "page_view",
            timestamp: T0 + HOUR,
            attributes: { path: "/pricing" },
          },
        ],
      },
      {
        actorId: "a2",
        events: [
          { eventName: "page_view", timestamp: T0, attributes: { path: "/" } },
        ],
      },
    ];

    const result = calculateFunnel(nodes, actors, {
      mode: "ORDERED",
      conversionWindowSeconds: DAY / 1000,
    });

    expect(result.nodes[0].entered).toBe(1);
  });
});

describe("plan versus reality", () => {
  it("reports variance to target in percentage points", () => {
    const nodes: NodeSpec[] = [
      {
        id: "n1",
        name: "Webinar",
        eventName: "webinar_attended",
        targetConversionRate: 0.14,
      },
      { id: "n2", name: "Call", eventName: "call_booked" },
    ];

    // 1000 attendees, 82 book — 8.2% against a 14% target.
    const actors: ActorStream[] = [
      ...Array.from({ length: 82 }, (_, i) =>
        actor(`c${i}`, [
          ["webinar_attended", 0],
          ["call_booked", HOUR],
        ]),
      ),
      ...Array.from({ length: 918 }, (_, i) =>
        actor(`n${i}`, [["webinar_attended", 0]]),
      ),
    ];

    const result = calculateFunnel(nodes, actors, {
      mode: "ORDERED",
      conversionWindowSeconds: 30 * 24 * 60 * 60,
    });

    expect(result.nodes[0].conversionRate).toBeCloseTo(0.082, 5);
    expect(result.nodes[0].varianceToTargetPoints).toBeCloseTo(-0.058, 5);
  });
});

describe("empty inputs", () => {
  it("returns null rates rather than zero when nobody entered", () => {
    const result = calculateFunnel(NODES, [], {
      mode: "ORDERED",
      conversionWindowSeconds: DAY / 1000,
    });

    expect(result.totalEntered).toBe(0);
    expect(result.overallConversionRate).toBeNull();
    expect(result.nodes[0].conversionRate).toBeNull();
  });
});
