import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Db } from "@/server/db";
import { orders, persons, refunds, subscriptions } from "@/server/db/schema";
import { stripeProvider } from "@/server/integrations";
import {
  recordOrder,
  recordRefund,
  reconcileRevenue,
  type RevenueContext,
} from "@/server/revenue/service";
import { ingestEvents } from "@/server/ingest";

import {
  closeDatabase,
  createTenant,
  prepareDatabase,
  testDb,
  truncateAll,
} from "./setup";

const db = testDb as unknown as Db;

let ctx: RevenueContext;
let projectId: string;

const OCCURRED = new Date("2026-08-01T12:00:00.000Z");

beforeAll(async () => {
  await prepareDatabase();
});

afterAll(async () => {
  await closeDatabase();
});

beforeEach(async () => {
  await truncateAll();
  const tenant = await createTenant("Revenue Co");
  projectId = tenant.project.id;
  ctx = {
    organizationId: tenant.organization.id,
    projectId: tenant.project.id,
    baseCurrency: "EUR",
    source: "STRIPE",
  };
});

describe("order recording", () => {
  it("resolves the buyer and records revenue in minor units", async () => {
    const { personId, created } = await recordOrder(db, ctx, {
      externalId: "cs_first",
      occurredAt: OCCURRED,
      grossMinor: 14_900,
      currency: "EUR",
      customer: { email: "buyer@example.com", stripeCustomerId: "cus_1" },
    });

    expect(created).toBe(true);
    expect(personId).not.toBeNull();

    const [person] = await testDb
      .select()
      .from(persons)
      .where(eq(persons.id, personId!));

    expect(person.email).toBe("buyer@example.com");
    expect(person.stripeCustomerId).toBe("cus_1");
    expect(person.lifetimeRevenueMinor).toBe(14_900);
  });

  it("is idempotent when a provider replays the same order", async () => {
    const input = {
      externalId: "cs_replayed",
      occurredAt: OCCURRED,
      grossMinor: 49_000,
      currency: "EUR",
      customer: { email: "replay@example.com" },
    };

    const first = await recordOrder(db, ctx, input);
    const second = await recordOrder(db, ctx, input);
    const third = await recordOrder(db, ctx, input);

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(third.created).toBe(false);

    const stored = await testDb
      .select()
      .from(orders)
      .where(eq(orders.projectId, projectId));

    expect(stored).toHaveLength(1);

    // The critical property: a retry must not double the customer's revenue.
    const [person] = await testDb
      .select()
      .from(persons)
      .where(eq(persons.email, "replay@example.com"));
    expect(person.lifetimeRevenueMinor).toBe(49_000);
  });

  it("stores an order even when the buyer cannot be identified", async () => {
    const { personId } = await recordOrder(db, ctx, {
      externalId: "cs_anonymous",
      occurredAt: OCCURRED,
      grossMinor: 1_000,
      currency: "EUR",
      customer: {},
    });

    expect(personId).toBeNull();
    const stored = await testDb.select().from(orders);
    // Losing real revenue because it cannot be attributed would be worse than
    // holding it unattributed; Tracking Health reports the gap instead.
    expect(stored).toHaveLength(1);
    expect(stored[0].personId).toBeNull();
  });

  it("numbers a person's orders in sequence", async () => {
    const customer = { email: "repeat@example.com" };
    await recordOrder(db, ctx, {
      externalId: "cs_a",
      occurredAt: OCCURRED,
      grossMinor: 10_000,
      currency: "EUR",
      customer,
    });
    await recordOrder(db, ctx, {
      externalId: "cs_b",
      occurredAt: new Date("2026-09-01T12:00:00.000Z"),
      grossMinor: 20_000,
      currency: "EUR",
      customer,
    });

    const stored = await testDb
      .select()
      .from(orders)
      .where(eq(orders.projectId, projectId));

    expect(stored.map((o) => o.orderIndex).sort()).toEqual([1, 2]);

    const [person] = await testDb
      .select()
      .from(persons)
      .where(eq(persons.email, "repeat@example.com"));
    expect(person.lifetimeRevenueMinor).toBe(30_000);
  });
});

describe("refunds", () => {
  it("reduces net revenue and is not applied twice on replay", async () => {
    await recordOrder(db, ctx, {
      externalId: "cs_refundable",
      occurredAt: OCCURRED,
      grossMinor: 50_000,
      currency: "EUR",
      customer: { email: "refund@example.com" },
    });

    const refund = {
      externalId: "re_1",
      orderExternalId: "cs_refundable",
      amountMinor: 20_000,
      currency: "EUR",
      occurredAt: new Date("2026-08-10T12:00:00.000Z"),
      customer: { email: "refund@example.com" },
    };

    await recordRefund(db, ctx, refund);
    await recordRefund(db, ctx, refund);

    const stored = await testDb.select().from(refunds);
    expect(stored).toHaveLength(1);

    const [order] = await testDb
      .select()
      .from(orders)
      .where(eq(orders.externalId, "cs_refundable"));
    expect(order.refundedMinor).toBe(20_000);

    const [person] = await testDb
      .select()
      .from(persons)
      .where(eq(persons.email, "refund@example.com"));
    expect(person.lifetimeRevenueMinor).toBe(30_000);
  });

  it("never refunds more than the order was worth", async () => {
    await recordOrder(db, ctx, {
      externalId: "cs_small",
      occurredAt: OCCURRED,
      grossMinor: 10_000,
      currency: "EUR",
      customer: { email: "over@example.com" },
    });

    await recordRefund(db, ctx, {
      externalId: "re_over",
      orderExternalId: "cs_small",
      amountMinor: 99_000,
      currency: "EUR",
      occurredAt: OCCURRED,
      customer: { email: "over@example.com" },
    });

    const [order] = await testDb
      .select()
      .from(orders)
      .where(eq(orders.externalId, "cs_small"));

    expect(order.refundedMinor).toBe(10_000);

    const [person] = await testDb
      .select()
      .from(persons)
      .where(eq(persons.email, "over@example.com"));
    expect(person.lifetimeRevenueMinor).toBe(0);
  });
});

describe("stripe webhook handling", () => {
  const handle = (event: unknown) =>
    stripeProvider.handleWebhook({
      db,
      ctx,
      rawBody: JSON.stringify(event),
      headers: new Headers(),
      config: {},
    });

  it("records a paid checkout session as an order", async () => {
    const outcome = await handle({
      id: "evt_checkout",
      type: "checkout.session.completed",
      created: 1_754_049_600,
      data: {
        object: {
          id: "cs_live_1",
          payment_status: "paid",
          amount_total: 89_000,
          currency: "eur",
          customer: "cus_live",
          customer_details: { email: "paid@example.com", name: "Paid Person" },
        },
      },
    });

    expect(outcome.action).toBe("order");

    const [order] = await testDb.select().from(orders);
    expect(order.grossMinor).toBe(89_000);
    expect(order.currency).toBe("EUR");
    expect(order.source).toBe("STRIPE");
  });

  it("ignores an unpaid checkout session", async () => {
    const outcome = await handle({
      id: "evt_unpaid",
      type: "checkout.session.completed",
      created: 1_754_049_600,
      data: {
        object: {
          id: "cs_unpaid",
          payment_status: "unpaid",
          amount_total: 89_000,
          currency: "eur",
        },
      },
    });

    expect(outcome.action).toBe("ignored");
    expect(await testDb.select().from(orders)).toHaveLength(0);
  });

  it("ignores the first subscription invoice, which checkout already recorded", async () => {
    const outcome = await handle({
      id: "evt_first_invoice",
      type: "invoice.payment_succeeded",
      created: 1_754_049_600,
      data: {
        object: {
          id: "in_1",
          amount_paid: 5_000,
          currency: "eur",
          billing_reason: "subscription_create",
        },
      },
    });

    // Recording both would double-count every new subscriber's first payment.
    expect(outcome.action).toBe("ignored");
    expect(await testDb.select().from(orders)).toHaveLength(0);
  });

  it("records a renewal invoice as revenue", async () => {
    const outcome = await handle({
      id: "evt_renewal",
      type: "invoice.payment_succeeded",
      created: 1_754_049_600,
      data: {
        object: {
          id: "in_2",
          amount_paid: 5_000,
          currency: "eur",
          billing_reason: "subscription_cycle",
          customer_email: "sub@example.com",
        },
      },
    });

    expect(outcome.action).toBe("order");
    const [order] = await testDb.select().from(orders);
    expect(order.grossMinor).toBe(5_000);
    expect(order.isRecurring).toBe("true");
  });

  it("normalises a yearly subscription price to a monthly MRR", async () => {
    await handle({
      id: "evt_sub",
      type: "customer.subscription.created",
      created: 1_754_049_600,
      data: {
        object: {
          id: "sub_1",
          status: "active",
          currency: "eur",
          start_date: 1_754_049_600,
          customer: "cus_sub",
          items: {
            data: [{ price: { unit_amount: 120_000, recurring: { interval: "year" } } }],
          },
        },
      },
    });

    const [subscription] = await testDb.select().from(subscriptions);
    expect(subscription.mrrMinor).toBe(10_000);
    expect(subscription.status).toBe("ACTIVE");
  });

  it("drops MRR to zero when a subscription is cancelled", async () => {
    const base = {
      id: "sub_2",
      currency: "eur",
      start_date: 1_754_049_600,
      customer: "cus_cancel",
      items: {
        data: [{ price: { unit_amount: 9_900, recurring: { interval: "month" } } }],
      },
    };

    await handle({
      id: "evt_sub_created",
      type: "customer.subscription.created",
      created: 1_754_049_600,
      data: { object: { ...base, status: "active" } },
    });

    await handle({
      id: "evt_sub_deleted",
      type: "customer.subscription.deleted",
      created: 1_754_136_000,
      data: { object: { ...base, status: "canceled", canceled_at: 1_754_136_000 } },
    });

    const stored = await testDb.select().from(subscriptions);
    expect(stored).toHaveLength(1);
    expect(stored[0].status).toBe("CANCELED");
    expect(stored[0].mrrMinor).toBe(0);
  });

  it("passes unrecognised event types through without failing", async () => {
    const outcome = await handle({
      id: "evt_other",
      type: "customer.discount.created",
      created: 1_754_049_600,
      data: { object: {} },
    });

    expect(outcome.action).toBe("ignored");
  });
});

describe("reconciliation", () => {
  it("reports the gap between browser events and canonical orders", async () => {
    // Canonical order from the payment provider.
    await recordOrder(db, ctx, {
      externalId: "cs_reconciled",
      occurredAt: OCCURRED,
      grossMinor: 20_000,
      currency: "EUR",
      customer: { email: "both@example.com" },
    });

    // A browser purchase event for a different buyer that never reached Stripe.
    await ingestEvents(
      db,
      {
        organizationId: ctx.organizationId,
        projectId: ctx.projectId,
        baseCurrency: "EUR",
        selfHost: null,
        source: "sdk",
      },
      [
        {
          event_id: "evt_browser_only",
          event_name: "purchase_completed",
          event_version: 1,
          timestamp: OCCURRED.toISOString(),
          anonymous_id: "anon_browser",
          identify: { email: "browseronly@example.com" },
          revenue: { amount: 500, currency: "EUR" },
          properties: {},
        },
      ] as never,
    );

    const report = await reconcileRevenue(db, projectId, {
      from: new Date("2026-07-01T00:00:00.000Z"),
      to: new Date("2026-09-01T00:00:00.000Z"),
    });

    expect(report.canonicalOrders).toBe(1);
    expect(report.canonicalRevenueMinor).toBe(20_000);
    expect(report.browserPurchaseEvents).toBe(1);
    expect(report.browserRevenueMinor).toBe(50_000);
    expect(report.browserEventsWithoutOrder).toBe(1);
    expect(report.matchRate).toBe(0);
    // Negative variance: the browser claims more revenue than the provider saw.
    expect(report.varianceMinor).toBe(-30_000);
  });

  it("reports a full match when every browser event has a canonical order", async () => {
    await recordOrder(db, ctx, {
      externalId: "cs_matched",
      occurredAt: OCCURRED,
      grossMinor: 20_000,
      currency: "EUR",
      customer: { email: "matched@example.com" },
    });

    await ingestEvents(
      db,
      {
        organizationId: ctx.organizationId,
        projectId: ctx.projectId,
        baseCurrency: "EUR",
        selfHost: null,
        source: "sdk",
      },
      [
        {
          event_id: "evt_matched",
          event_name: "purchase_completed",
          event_version: 1,
          timestamp: OCCURRED.toISOString(),
          anonymous_id: "anon_matched",
          identify: { email: "matched@example.com" },
          revenue: { amount: 200, currency: "EUR" },
          properties: {},
        },
      ] as never,
    );

    const report = await reconcileRevenue(db, projectId, {
      from: new Date("2026-07-01T00:00:00.000Z"),
      to: new Date("2026-09-01T00:00:00.000Z"),
    });

    expect(report.browserEventsWithoutOrder).toBe(0);
    expect(report.matchRate).toBe(1);
    expect(report.varianceMinor).toBe(0);
  });
});
