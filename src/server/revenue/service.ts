import { and, eq, gte, lte, sql } from "drizzle-orm";

import type { Db } from "@/server/db";
import {
  events,
  orders,
  payments,
  persons,
  refunds,
  subscriptions,
} from "@/server/db/schema";
import { resolveIdentity } from "@/server/identity/resolve";

/**
 * Provider-agnostic revenue recording.
 *
 * Stripe, a generic webhook and a CSV import all funnel through here, so the
 * rules that make revenue trustworthy — idempotency, identity resolution and
 * lifetime-value recomputation — exist in exactly one place.
 *
 * Every write is keyed on `(project_id, external_id)`. Payment providers retry
 * webhooks aggressively and deliver out of order; without that key a single
 * retry would double a customer's recorded revenue.
 */

export type RevenueContext = {
  organizationId: string;
  projectId: string;
  baseCurrency: string;
  source: "STRIPE" | "WEBHOOK" | "CSV_IMPORT" | "API";
};

export type CustomerRef = {
  email?: string | null;
  externalUserId?: string | null;
  stripeCustomerId?: string | null;
  name?: string | null;
};

export type OrderInput = {
  externalId: string;
  occurredAt: Date;
  grossMinor: number;
  currency: string;
  productName?: string | null;
  isRecurring?: boolean;
  customer: CustomerRef;
  metadata?: Record<string, unknown>;
};

export type PaymentInput = {
  externalId: string;
  orderExternalId?: string | null;
  status: "SUCCEEDED" | "FAILED" | "PENDING" | "REFUNDED" | "PARTIALLY_REFUNDED";
  amountMinor: number;
  currency: string;
  occurredAt: Date;
  customer: CustomerRef;
  metadata?: Record<string, unknown>;
};

export type RefundInput = {
  externalId: string;
  orderExternalId?: string | null;
  amountMinor: number;
  currency: string;
  occurredAt: Date;
  reason?: string | null;
  customer: CustomerRef;
};

export type SubscriptionInput = {
  externalId: string;
  status: "ACTIVE" | "PAST_DUE" | "CANCELED" | "TRIALING";
  mrrMinor: number;
  currency: string;
  startedAt: Date;
  canceledAt?: Date | null;
  productName?: string | null;
  customer: CustomerRef;
};

/**
 * Finds or creates the person a revenue record belongs to.
 *
 * Returns null when the provider gave us nothing to identify by. Such records
 * are still stored — losing real revenue because it cannot be attributed would
 * be worse — but they are counted by Tracking Health as unreconciled.
 */
async function resolveCustomer(
  db: Db,
  ctx: RevenueContext,
  customer: CustomerRef,
  occurredAt: Date,
): Promise<string | null> {
  if (
    !customer.email &&
    !customer.externalUserId &&
    !customer.stripeCustomerId
  ) {
    return null;
  }

  return resolveIdentity(db, {
    organizationId: ctx.organizationId,
    projectId: ctx.projectId,
    anonymousId: null,
    identify: {
      email: customer.email ?? undefined,
      userId: customer.externalUserId ?? undefined,
      stripeCustomerId: customer.stripeCustomerId ?? undefined,
      name: customer.name ?? undefined,
    },
    occurredAt,
  });
}

export async function recordOrder(
  db: Db,
  ctx: RevenueContext,
  input: OrderInput,
): Promise<{ orderId: string; personId: string | null; created: boolean }> {
  const personId = await resolveCustomer(
    db,
    ctx,
    input.customer,
    input.occurredAt,
  );

  const existing = await db
    .select({ id: orders.id })
    .from(orders)
    .where(
      and(
        eq(orders.projectId, ctx.projectId),
        eq(orders.externalId, input.externalId),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    // A replayed webhook may carry a corrected amount or a customer we can
    // now resolve, so update rather than ignore — but never duplicate.
    await db
      .update(orders)
      .set({
        grossMinor: input.grossMinor,
        currency: input.currency,
        productName: input.productName ?? null,
        occurredAt: input.occurredAt,
        personId: personId ?? sql`${orders.personId}`,
        metadata: input.metadata ?? null,
      })
      .where(eq(orders.id, existing[0].id));

    if (personId) await recomputeLifetimeRevenue(db, personId);
    return { orderId: existing[0].id, personId, created: false };
  }

  const orderIndex = personId
    ? await nextOrderIndex(db, ctx.projectId, personId)
    : null;

  const [created] = await db
    .insert(orders)
    .values({
      organizationId: ctx.organizationId,
      projectId: ctx.projectId,
      personId,
      externalId: input.externalId,
      source: ctx.source,
      occurredAt: input.occurredAt,
      grossMinor: input.grossMinor,
      currency: input.currency,
      productName: input.productName ?? null,
      isRecurring: input.isRecurring ? "true" : "false",
      orderIndex,
      metadata: input.metadata ?? null,
    })
    .returning({ id: orders.id });

  if (personId) await recomputeLifetimeRevenue(db, personId);

  return { orderId: created.id, personId, created: true };
}

export async function recordPayment(
  db: Db,
  ctx: RevenueContext,
  input: PaymentInput,
): Promise<void> {
  const personId = await resolveCustomer(
    db,
    ctx,
    input.customer,
    input.occurredAt,
  );

  const orderId = input.orderExternalId
    ? await findOrderId(db, ctx.projectId, input.orderExternalId)
    : null;

  await db
    .insert(payments)
    .values({
      organizationId: ctx.organizationId,
      projectId: ctx.projectId,
      orderId,
      personId,
      externalId: input.externalId,
      status: input.status,
      amountMinor: input.amountMinor,
      currency: input.currency,
      occurredAt: input.occurredAt,
      metadata: input.metadata ?? null,
    })
    .onConflictDoUpdate({
      target: [payments.projectId, payments.externalId],
      set: { status: input.status, amountMinor: input.amountMinor },
    });
}

export async function recordRefund(
  db: Db,
  ctx: RevenueContext,
  input: RefundInput,
): Promise<void> {
  const personId = await resolveCustomer(
    db,
    ctx,
    input.customer,
    input.occurredAt,
  );

  const orderId = input.orderExternalId
    ? await findOrderId(db, ctx.projectId, input.orderExternalId)
    : null;

  const inserted = await db
    .insert(refunds)
    .values({
      organizationId: ctx.organizationId,
      projectId: ctx.projectId,
      orderId,
      personId,
      externalId: input.externalId,
      amountMinor: input.amountMinor,
      currency: input.currency,
      occurredAt: input.occurredAt,
      reason: input.reason ?? null,
    })
    .onConflictDoNothing({
      target: [refunds.projectId, refunds.externalId],
    })
    .returning({ id: refunds.id });

  // Only move the order's refunded total on a genuinely new refund; a replayed
  // webhook must not refund the same money twice.
  if (inserted.length > 0 && orderId) {
    await db
      .update(orders)
      .set({
        refundedMinor: sql`least(${orders.grossMinor}, ${orders.refundedMinor} + ${input.amountMinor})`,
      })
      .where(eq(orders.id, orderId));
  }

  if (inserted.length > 0 && personId) {
    await recomputeLifetimeRevenue(db, personId);
  }
}

export async function recordSubscription(
  db: Db,
  ctx: RevenueContext,
  input: SubscriptionInput,
): Promise<void> {
  const personId = await resolveCustomer(
    db,
    ctx,
    input.customer,
    input.startedAt,
  );

  await db
    .insert(subscriptions)
    .values({
      organizationId: ctx.organizationId,
      projectId: ctx.projectId,
      personId,
      externalId: input.externalId,
      status: input.status,
      mrrMinor: input.mrrMinor,
      currency: input.currency,
      startedAt: input.startedAt,
      canceledAt: input.canceledAt ?? null,
      productName: input.productName ?? null,
    })
    .onConflictDoUpdate({
      target: [subscriptions.projectId, subscriptions.externalId],
      set: {
        status: input.status,
        mrrMinor: input.mrrMinor,
        canceledAt: input.canceledAt ?? null,
      },
    });
}

async function findOrderId(
  db: Db,
  projectId: string,
  externalId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ id: orders.id })
    .from(orders)
    .where(and(eq(orders.projectId, projectId), eq(orders.externalId, externalId)))
    .limit(1);

  return row?.id ?? null;
}

async function nextOrderIndex(
  db: Db,
  projectId: string,
  personId: string,
): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`count(*)` })
    .from(orders)
    .where(and(eq(orders.projectId, projectId), eq(orders.personId, personId)));

  return Number(row?.total ?? 0) + 1;
}

/**
 * Recomputes a person's lifetime revenue from scratch rather than adjusting it
 * incrementally. Incremental arithmetic drifts the moment a webhook arrives
 * twice or out of order, and this figure drives the Journey Explorer.
 */
export async function recomputeLifetimeRevenue(
  db: Db,
  personId: string,
): Promise<void> {
  const [row] = await db
    .select({
      net: sql<number>`coalesce(sum(${orders.grossMinor} - ${orders.refundedMinor}), 0)`,
    })
    .from(orders)
    .where(eq(orders.personId, personId));

  await db
    .update(persons)
    .set({ lifetimeRevenueMinor: Number(row?.net ?? 0), updatedAt: new Date() })
    .where(eq(persons.id, personId));
}

/**
 * Reconciliation between browser purchase events and canonical orders.
 *
 * The browser is not trusted for revenue: an ad blocker, a closed tab or a
 * failed redirect all lose the event, and a double-fired tag invents one. When
 * a payment provider is connected its record is canonical, and this report
 * shows where the two disagree so the gap is visible rather than assumed away.
 */
export type ReconciliationReport = {
  canonicalOrders: number;
  canonicalRevenueMinor: number;
  browserPurchaseEvents: number;
  browserRevenueMinor: number;
  ordersWithoutPerson: number;
  /** Browser events with no canonical order within the matching window. */
  browserEventsWithoutOrder: number;
  varianceMinor: number;
  matchRate: number | null;
};

export async function reconcileRevenue(
  db: Db,
  projectId: string,
  range: { from: Date; to: Date },
): Promise<ReconciliationReport> {
  const [orderRow] = await db
    .select({
      count: sql<number>`count(*)`,
      gross: sql<number>`coalesce(sum(${orders.grossMinor}), 0)`,
      orphaned: sql<number>`count(*) filter (where ${orders.personId} is null)`,
    })
    .from(orders)
    .where(
      and(
        eq(orders.projectId, projectId),
        gte(orders.occurredAt, range.from),
        lte(orders.occurredAt, range.to),
      ),
    );

  const [eventRow] = await db
    .select({
      count: sql<number>`count(*)`,
      revenue: sql<number>`coalesce(sum(${events.revenueMinor}), 0)`,
    })
    .from(events)
    .where(
      and(
        eq(events.projectId, projectId),
        eq(events.eventName, "purchase_completed"),
        gte(events.timestamp, range.from),
        lte(events.timestamp, range.to),
      ),
    );

  /**
   * A browser event is considered matched when the same person has a canonical
   * order within 24 hours of it. Matching on amount alone would mis-pair two
   * customers who bought the same product on the same day.
   */
  const [unmatchedRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(events)
    .where(
      and(
        eq(events.projectId, projectId),
        eq(events.eventName, "purchase_completed"),
        gte(events.timestamp, range.from),
        lte(events.timestamp, range.to),
        // Safe as a correlated subquery: inside `where`, Drizzle renders a
        // column reference fully qualified, so `events.person_id` cannot bind
        // to the inner table's column of the same name.
        sql`not exists (
          select 1 from orders o
          where o.project_id = ${projectId}
            and o.person_id is not distinct from ${events.personId}
            and o.person_id is not null
            and abs(extract(epoch from (o.occurred_at - ${events.timestamp}))) < 86400
        )`,
      ),
    );

  const canonicalOrders = Number(orderRow?.count ?? 0);
  const canonicalRevenue = Number(orderRow?.gross ?? 0);
  const browserEvents = Number(eventRow?.count ?? 0);
  const browserRevenue = Number(eventRow?.revenue ?? 0);
  const unmatched = Number(unmatchedRow?.count ?? 0);

  return {
    canonicalOrders,
    canonicalRevenueMinor: canonicalRevenue,
    browserPurchaseEvents: browserEvents,
    browserRevenueMinor: browserRevenue,
    ordersWithoutPerson: Number(orderRow?.orphaned ?? 0),
    browserEventsWithoutOrder: unmatched,
    varianceMinor: canonicalRevenue - browserRevenue,
    matchRate:
      browserEvents === 0 ? null : (browserEvents - unmatched) / browserEvents,
  };
}
