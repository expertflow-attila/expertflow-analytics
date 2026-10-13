import {
  and,
  asc,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNotNull,
  isNull,
  lte,
  sql,
} from "drizzle-orm";

import type {
  ActorStream,
  AnalyticsEvent,
  NodeSpec,
} from "@/lib/analytics/funnel-core";
import { calculateFunnel, type FunnelResult } from "@/lib/analytics/funnel-core";
import type { Conversion } from "@/lib/analytics/attribution-core";
import type { CustomerRecord } from "@/lib/analytics/ltv-core";
import { db } from "@/server/db";
import {
  anonymousIdentities,
  events,
  funnelNodes,
  funnels,
  ingestLogs,
  orders,
  persons,
  refunds,
  sessions,
  subscriptions,
  touchpoints,
} from "@/server/db/schema";
import type { TenantContext } from "@/server/tenancy";

export type DateRange = { from: Date; to: Date };

/**
 * The effective actor for an event.
 *
 * An event may already carry a person id (ingest back-filled it), or it may
 * only carry the anonymous id of a browser that was later linked to a person.
 * Both must collapse to the SAME actor, otherwise one human is counted twice —
 * once anonymously at the top of the funnel and once identified further down,
 * which makes every step after the first look like it converts nobody.
 *
 * Falls back to the raw anonymous id for visitors who never identified, so
 * top-of-funnel traffic is still counted.
 */
const ACTOR_ID = sql<string>`coalesce(${events.personId}, ${anonymousIdentities.personId}, ${events.anonymousId})`;

/** Join condition pairing each event with its browser identity, if linked. */
const IDENTITY_JOIN = and(
  eq(anonymousIdentities.projectId, events.projectId),
  eq(anonymousIdentities.anonymousId, events.anonymousId),
);

export function rangeDays(range: DateRange): number {
  return Math.max(
    1,
    Math.round((range.to.getTime() - range.from.getTime()) / 86_400_000),
  );
}

export function previousRange(range: DateRange): DateRange {
  const span = range.to.getTime() - range.from.getTime();
  return {
    from: new Date(range.from.getTime() - span),
    to: new Date(range.from.getTime()),
  };
}

/**
 * Loads the funnel definition plus the actor streams needed to compute it.
 *
 * Actors are keyed by person id when known and by anonymous id otherwise, so a
 * visitor who never identifies still counts at the top of the funnel. This is
 * the single most consequential modelling decision in the query layer: keying
 * only on person id would silently discard most top-of-funnel traffic.
 */
export async function loadFunnel(
  ctx: TenantContext,
  funnelId: string,
  range: DateRange,
): Promise<{
  funnel: typeof funnels.$inferSelect;
  nodes: NodeSpec[];
  result: FunnelResult;
} | null> {
  const [funnel] = await db
    .select()
    .from(funnels)
    .where(and(eq(funnels.id, funnelId), eq(funnels.projectId, ctx.projectId)))
    .limit(1);

  if (!funnel) return null;

  const nodeRows = await db
    .select()
    .from(funnelNodes)
    .where(eq(funnelNodes.funnelId, funnel.id))
    .orderBy(asc(funnelNodes.stepIndex));

  const nodes: NodeSpec[] = nodeRows.map((node) => ({
    id: node.id,
    name: node.name,
    eventName: node.matchRule.eventName,
    filters: node.matchRule.filters,
    targetConversionRate: node.targetConversionRate,
  }));

  const eventNames = [...new Set(nodes.map((n) => n.eventName))];

  const rows = await db
    .select({
      eventName: events.eventName,
      timestamp: events.timestamp,
      actorId: ACTOR_ID,
      revenueMinor: events.revenueMinor,
      pagePath: events.pagePath,
      deviceType: events.deviceType,
      channel: events.channel,
      country: events.country,
      properties: events.properties,
    })
    .from(events)
    .leftJoin(anonymousIdentities, IDENTITY_JOIN)
    .where(
      and(
        eq(events.projectId, ctx.projectId),
        gte(events.timestamp, range.from),
        lte(events.timestamp, range.to),
        inArray(events.eventName, eventNames),
      ),
    )
    .orderBy(asc(events.timestamp));

  const streams = new Map<string, AnalyticsEvent[]>();

  for (const row of rows) {
    const actorId = row.actorId;
    if (!actorId) continue;

    const list = streams.get(actorId) ?? [];
    list.push({
      eventName: row.eventName,
      timestamp: row.timestamp.getTime(),
      revenueMinor: row.revenueMinor,
      attributes: {
        path: row.pagePath,
        device_type: row.deviceType,
        channel: row.channel,
        country: row.country,
        ...(row.properties ?? {}),
      },
    });
    streams.set(actorId, list);
  }

  const actors: ActorStream[] = [...streams.entries()].map(
    ([actorId, list]) => ({ actorId, events: list }),
  );

  const result = calculateFunnel(nodes, actors, {
    mode: funnel.mode,
    conversionWindowSeconds: funnel.conversionWindowSeconds,
  });

  return { funnel, nodes, result };
}

/**
 * Builds conversions with their full touchpoint history for the attribution
 * engine. Orders without a resolved person cannot be attributed at all — they
 * are counted separately and surfaced by Tracking Health rather than silently
 * dropped.
 */
export async function loadConversions(
  ctx: TenantContext,
  range: DateRange,
  windowDays: number,
): Promise<{ conversions: Conversion[]; unattributableOrders: number }> {
  const orderRows = await db
    .select({
      id: orders.id,
      personId: orders.personId,
      occurredAt: orders.occurredAt,
      grossMinor: orders.grossMinor,
      refundedMinor: orders.refundedMinor,
    })
    .from(orders)
    .where(
      and(
        eq(orders.projectId, ctx.projectId),
        gte(orders.occurredAt, range.from),
        lte(orders.occurredAt, range.to),
      ),
    );

  const identified = orderRows.filter((o) => o.personId);
  const unattributableOrders = orderRows.length - identified.length;

  if (identified.length === 0) {
    return { conversions: [], unattributableOrders };
  }

  const personIds = [...new Set(identified.map((o) => o.personId!))];
  const earliest = new Date(
    range.from.getTime() - windowDays * 24 * 60 * 60 * 1000,
  );

  const touchpointRows = await db
    .select({
      id: touchpoints.id,
      personId: touchpoints.personId,
      channel: touchpoints.channel,
      source: touchpoints.source,
      campaign: touchpoints.campaign,
      occurredAt: touchpoints.occurredAt,
      isLeadConversion: touchpoints.isLeadConversion,
    })
    .from(touchpoints)
    .where(
      and(
        eq(touchpoints.projectId, ctx.projectId),
        gte(touchpoints.occurredAt, earliest),
        inArray(touchpoints.personId, personIds),
      ),
    )
    .orderBy(asc(touchpoints.occurredAt));

  const byPerson = new Map<string, Conversion["touchpoints"]>();
  for (const row of touchpointRows) {
    if (!row.personId) continue;
    const list = byPerson.get(row.personId) ?? [];
    list.push({
      id: row.id,
      channel: row.channel,
      source: row.source,
      campaign: row.campaign,
      occurredAt: row.occurredAt.getTime(),
      isLeadConversion: row.isLeadConversion === "true",
    });
    byPerson.set(row.personId, list);
  }

  const conversions: Conversion[] = identified.map((order) => ({
    id: order.id,
    personId: order.personId!,
    occurredAt: order.occurredAt.getTime(),
    // Refunded revenue is never attributed — crediting a channel for money
    // that was given back is how channel ROI reports overstate performance.
    revenueMinor: Math.max(0, order.grossMinor - order.refundedMinor),
    touchpoints: byPerson.get(order.personId!) ?? [],
  }));

  return { conversions, unattributableOrders };
}

/** Customer records for cohort and LTV analysis, cohorted by acquisition month. */
export async function loadCustomers(
  ctx: TenantContext,
  cohortBy: "month" | "channel" = "month",
): Promise<CustomerRecord[]> {
  const orderRows = await db
    .select({
      personId: orders.personId,
      occurredAt: orders.occurredAt,
      grossMinor: orders.grossMinor,
    })
    .from(orders)
    .where(and(eq(orders.projectId, ctx.projectId), isNotNull(orders.personId)))
    .orderBy(asc(orders.occurredAt));

  const refundRows = await db
    .select({
      personId: refunds.personId,
      occurredAt: refunds.occurredAt,
      amountMinor: refunds.amountMinor,
    })
    .from(refunds)
    .where(eq(refunds.projectId, ctx.projectId));

  const byPerson = new Map<string, CustomerRecord>();

  for (const row of orderRows) {
    const personId = row.personId!;
    const existing = byPerson.get(personId);

    if (existing) {
      existing.orders.push({
        occurredAt: row.occurredAt.getTime(),
        grossMinor: row.grossMinor,
      });
      continue;
    }

    byPerson.set(personId, {
      personId,
      acquiredAt: row.occurredAt.getTime(),
      cohortKey: row.occurredAt.toISOString().slice(0, 7),
      orders: [
        { occurredAt: row.occurredAt.getTime(), grossMinor: row.grossMinor },
      ],
      refunds: [],
    });
  }

  for (const row of refundRows) {
    if (!row.personId) continue;
    byPerson.get(row.personId)?.refunds.push({
      occurredAt: row.occurredAt.getTime(),
      amountMinor: row.amountMinor,
    });
  }

  if (cohortBy === "channel") {
    const firstTouch = await db
      .select({
        personId: touchpoints.personId,
        channel: touchpoints.channel,
      })
      .from(touchpoints)
      .where(
        and(
          eq(touchpoints.projectId, ctx.projectId),
          isNotNull(touchpoints.personId),
        ),
      )
      .orderBy(asc(touchpoints.occurredAt));

    const acquisitionChannel = new Map<string, string>();
    for (const row of firstTouch) {
      if (row.personId && !acquisitionChannel.has(row.personId)) {
        acquisitionChannel.set(row.personId, row.channel);
      }
    }

    for (const customer of byPerson.values()) {
      customer.cohortKey =
        acquisitionChannel.get(customer.personId) ?? "Unknown";
    }
  }

  return [...byPerson.values()];
}

export type OverviewMetrics = {
  visitors: number;
  leads: number;
  customers: number;
  grossRevenueMinor: number;
  refundedMinor: number;
  netRevenueMinor: number;
  ordersCount: number;
  mrrMinor: number;
  averageOrderValueMinor: number | null;
  revenuePerVisitorMinor: number | null;
};

export async function loadOverview(
  ctx: TenantContext,
  range: DateRange,
): Promise<OverviewMetrics> {
  const scope = and(
    eq(events.projectId, ctx.projectId),
    gte(events.timestamp, range.from),
    lte(events.timestamp, range.to),
  );

  const [visitorRow] = await db
    .select({ visitors: sql<number>`count(distinct ${ACTOR_ID})` })
    .from(events)
    .leftJoin(anonymousIdentities, IDENTITY_JOIN)
    .where(scope);

  const [leadRow] = await db
    .select({ leads: sql<number>`count(distinct ${events.personId})` })
    .from(events)
    .where(and(scope, eq(events.eventName, "lead_created")));

  const [orderRow] = await db
    .select({
      ordersCount: sql<number>`count(*)`,
      customers: sql<number>`count(distinct ${orders.personId})`,
      gross: sql<number>`coalesce(sum(${orders.grossMinor}), 0)`,
    })
    .from(orders)
    .where(
      and(
        eq(orders.projectId, ctx.projectId),
        gte(orders.occurredAt, range.from),
        lte(orders.occurredAt, range.to),
      ),
    );

  const [refundRow] = await db
    .select({ refunded: sql<number>`coalesce(sum(${refunds.amountMinor}), 0)` })
    .from(refunds)
    .where(
      and(
        eq(refunds.projectId, ctx.projectId),
        gte(refunds.occurredAt, range.from),
        lte(refunds.occurredAt, range.to),
      ),
    );

  const [mrrRow] = await db
    .select({ mrr: sql<number>`coalesce(sum(${subscriptions.mrrMinor}), 0)` })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.projectId, ctx.projectId),
        eq(subscriptions.status, "ACTIVE"),
      ),
    );

  const visitors = Number(visitorRow?.visitors ?? 0);
  const gross = Number(orderRow?.gross ?? 0);
  const refunded = Number(refundRow?.refunded ?? 0);
  const ordersCount = Number(orderRow?.ordersCount ?? 0);

  return {
    visitors,
    leads: Number(leadRow?.leads ?? 0),
    customers: Number(orderRow?.customers ?? 0),
    grossRevenueMinor: gross,
    refundedMinor: refunded,
    netRevenueMinor: gross - refunded,
    ordersCount,
    mrrMinor: Number(mrrRow?.mrr ?? 0),
    averageOrderValueMinor:
      ordersCount === 0 ? null : Math.round(gross / ordersCount),
    revenuePerVisitorMinor:
      visitors === 0 ? null : Math.round((gross - refunded) / visitors),
  };
}

/** Daily series for charts and anomaly detection, bucketed in org timezone. */
export async function loadDailySeries(
  ctx: TenantContext,
  range: DateRange,
): Promise<{
  visitors: Array<{ date: string; value: number }>;
  leads: Array<{ date: string; value: number }>;
  revenue: Array<{ date: string; value: number }>;
}> {
  const bucket = (column: typeof events.timestamp) =>
    sql<string>`to_char(${column} at time zone ${ctx.timezone}::text, 'YYYY-MM-DD')`;

  /**
   * Group and order by ordinal position rather than by repeating the
   * expression. The timezone arrives as a bound parameter, so repeating the
   * expression produces a different placeholder ($5 rather than $1) and
   * Postgres no longer recognises the two as the same expression.
   */
  const byBucket = sql`1`;

  const visitorRows = await db
    .select({
      date: bucket(events.timestamp),
      value: sql<number>`count(distinct ${ACTOR_ID})`,
    })
    .from(events)
    .leftJoin(anonymousIdentities, IDENTITY_JOIN)
    .where(
      and(
        eq(events.projectId, ctx.projectId),
        gte(events.timestamp, range.from),
        lte(events.timestamp, range.to),
      ),
    )
    .groupBy(byBucket)
    .orderBy(byBucket);

  const leadRows = await db
    .select({
      date: bucket(events.timestamp),
      value: sql<number>`count(distinct ${events.personId})`,
    })
    .from(events)
    .where(
      and(
        eq(events.projectId, ctx.projectId),
        eq(events.eventName, "lead_created"),
        gte(events.timestamp, range.from),
        lte(events.timestamp, range.to),
      ),
    )
    .groupBy(byBucket)
    .orderBy(byBucket);

  const revenueBucket = sql<string>`to_char(${orders.occurredAt} at time zone ${ctx.timezone}::text, 'YYYY-MM-DD')`;
  const revenueRows = await db
    .select({
      date: revenueBucket,
      value: sql<number>`coalesce(sum(${orders.grossMinor}), 0)`,
    })
    .from(orders)
    .where(
      and(
        eq(orders.projectId, ctx.projectId),
        gte(orders.occurredAt, range.from),
        lte(orders.occurredAt, range.to),
      ),
    )
    .groupBy(byBucket)
    .orderBy(byBucket);

  const toSeries = (rows: Array<{ date: string; value: unknown }>) =>
    rows.map((r) => ({ date: r.date, value: Number(r.value) }));

  return {
    visitors: toSeries(visitorRows),
    leads: toSeries(leadRows),
    revenue: toSeries(revenueRows),
  };
}

/** Raw inputs for the Tracking Health engine. */
export async function loadTrackingHealthInput(
  ctx: TenantContext,
  range: DateRange,
) {
  const eventScope = and(
    eq(events.projectId, ctx.projectId),
    gte(events.timestamp, range.from),
    lte(events.timestamp, range.to),
  );

  const [eventRow] = await db
    .select({
      total: sql<number>`count(*)`,
      anonymous: sql<number>`count(*) filter (where ${events.personId} is null)`,
      paid: sql<number>`count(*) filter (where ${events.channel} in ('Paid Search','Paid Social','Display'))`,
      paidMissingCampaign: sql<number>`count(*) filter (where ${events.channel} in ('Paid Search','Paid Social','Display') and ${events.utmCampaign} is null)`,
    })
    .from(events)
    .where(eventScope);

  const [sessionRow] = await db
    .select({
      total: sql<number>`count(*)`,
      unknown: sql<number>`count(*) filter (where ${sessions.channel} in ('Unknown','Direct') or ${sessions.channel} is null)`,
    })
    .from(sessions)
    .where(
      and(
        eq(sessions.projectId, ctx.projectId),
        gte(sessions.startedAt, range.from),
        lte(sessions.startedAt, range.to),
      ),
    );

  const [orderRow] = await db
    .select({
      total: sql<number>`count(*)`,
      orphaned: sql<number>`count(*) filter (where ${orders.personId} is null)`,
    })
    .from(orders)
    .where(
      and(
        eq(orders.projectId, ctx.projectId),
        gte(orders.occurredAt, range.from),
        lte(orders.occurredAt, range.to),
      ),
    );

  const [ingestRow] = await db
    .select({
      requests: sql<number>`count(*)`,
      duplicates: sql<number>`coalesce(sum(${ingestLogs.duplicates}), 0)`,
      errors: sql<number>`count(*) filter (where ${ingestLogs.errorCode} is not null)`,
    })
    .from(ingestLogs)
    .where(
      and(
        eq(ingestLogs.projectId, ctx.projectId),
        gte(ingestLogs.receivedAt, range.from),
      ),
    );

  const [unmatchedStripe] = await db
    .select({ count: sql<number>`count(*)` })
    .from(persons)
    .where(
      and(
        eq(persons.projectId, ctx.projectId),
        isNotNull(persons.stripeCustomerId),
        isNull(persons.email),
      ),
    );

  return {
    totalEvents: Number(eventRow?.total ?? 0),
    duplicateEvents: Number(ingestRow?.duplicates ?? 0),
    eventsWithoutIdentity: Number(eventRow?.anonymous ?? 0),
    sessionsWithUnknownSource: Number(sessionRow?.unknown ?? 0),
    totalSessions: Number(sessionRow?.total ?? 0),
    purchasesWithoutPerson: Number(orderRow?.orphaned ?? 0),
    totalPurchases: Number(orderRow?.total ?? 0),
    unmatchedStripeCustomers: Number(unmatchedStripe?.count ?? 0),
    ingestErrors: Number(ingestRow?.errors ?? 0),
    ingestRequests: Number(ingestRow?.requests ?? 0),
    eventsMissingUtmOnPaid: Number(eventRow?.paidMissingCampaign ?? 0),
    paidEvents: Number(eventRow?.paid ?? 0),
  };
}

/** One person's complete chronological journey. */
export async function loadJourney(ctx: TenantContext, personId: string) {
  const [person] = await db
    .select()
    .from(persons)
    .where(and(eq(persons.id, personId), eq(persons.projectId, ctx.projectId)))
    .limit(1);

  if (!person) return null;

  const timeline = await db
    .select({
      eventName: events.eventName,
      timestamp: events.timestamp,
      channel: events.channel,
      pagePath: events.pagePath,
      utmCampaign: events.utmCampaign,
      revenueMinor: events.revenueMinor,
      properties: events.properties,
    })
    .from(events)
    .where(
      and(eq(events.projectId, ctx.projectId), eq(events.personId, personId)),
    )
    .orderBy(asc(events.timestamp))
    .limit(500);

  const personTouchpoints = await db
    .select()
    .from(touchpoints)
    .where(
      and(
        eq(touchpoints.projectId, ctx.projectId),
        eq(touchpoints.personId, personId),
      ),
    )
    .orderBy(asc(touchpoints.occurredAt));

  const personOrders = await db
    .select()
    .from(orders)
    .where(
      and(eq(orders.projectId, ctx.projectId), eq(orders.personId, personId)),
    )
    .orderBy(asc(orders.occurredAt));

  return { person, timeline, touchpoints: personTouchpoints, orders: personOrders };
}

export async function listJourneys(
  ctx: TenantContext,
  options: { limit?: number; onlyCustomers?: boolean } = {},
) {
  const { limit = 50, onlyCustomers = false } = options;

  /**
   * Deliberately three queries rather than correlated subqueries.
   *
   * Inside a `.select({...})` projection Drizzle renders a column reference
   * unqualified — `${persons.id}` becomes `"id"`, not `"persons"."id"`. In a
   * subquery over a table that also has an `id` column that silently binds to
   * the INNER table, so the correlation is lost and every row comes back null
   * with no error. Joining explicitly removes the trap entirely.
   */
  const rows = await db
    .select({
      id: persons.id,
      name: persons.name,
      email: persons.email,
      firstSeenAt: persons.firstSeenAt,
      lastSeenAt: persons.lastSeenAt,
      lifetimeRevenueMinor: persons.lifetimeRevenueMinor,
    })
    .from(persons)
    .where(
      onlyCustomers
        ? and(
            eq(persons.projectId, ctx.projectId),
            gt(persons.lifetimeRevenueMinor, 0),
          )
        : eq(persons.projectId, ctx.projectId),
    )
    .orderBy(desc(persons.lifetimeRevenueMinor), desc(persons.lastSeenAt))
    .limit(limit);

  if (rows.length === 0) return [];

  const ids = rows.map((row) => row.id);

  const touchRows = await db
    .select({
      personId: touchpoints.personId,
      channel: touchpoints.channel,
      occurredAt: touchpoints.occurredAt,
    })
    .from(touchpoints)
    .where(
      and(
        eq(touchpoints.projectId, ctx.projectId),
        inArray(touchpoints.personId, ids),
      ),
    )
    .orderBy(asc(touchpoints.occurredAt));

  const firstTouch = new Map<string, string>();
  const lastTouch = new Map<string, string>();
  for (const row of touchRows) {
    if (!row.personId) continue;
    if (!firstTouch.has(row.personId)) firstTouch.set(row.personId, row.channel);
    lastTouch.set(row.personId, row.channel);
  }

  const countRows = await db
    .select({
      personId: events.personId,
      total: sql<number>`count(*)`,
    })
    .from(events)
    .where(
      and(eq(events.projectId, ctx.projectId), inArray(events.personId, ids)),
    )
    .groupBy(events.personId);

  const counts = new Map(
    countRows.map((row) => [row.personId!, Number(row.total)]),
  );

  return rows.map((row) => ({
    ...row,
    firstTouchChannel: firstTouch.get(row.id) ?? null,
    lastTouchChannel: lastTouch.get(row.id) ?? null,
    eventCount: counts.get(row.id) ?? 0,
  }));
}

/**
 * Observed journeys: the paths people actually take, independent of any funnel
 * anyone drew. This is what makes "planned vs reality" possible.
 */
export async function loadObservedPaths(
  ctx: TenantContext,
  range: DateRange,
  options: { onlyBuyers?: boolean; maxSteps?: number } = {},
) {
  const { onlyBuyers = false, maxSteps = 8 } = options;

  const rows = await db
    .select({
      personId: events.personId,
      eventName: events.eventName,
      timestamp: events.timestamp,
    })
    .from(events)
    .where(
      and(
        eq(events.projectId, ctx.projectId),
        isNotNull(events.personId),
        gte(events.timestamp, range.from),
        lte(events.timestamp, range.to),
        // page_view dominates every path and carries no funnel meaning here.
        sql`${events.eventName} not in ('page_view', 'session_started')`,
      ),
    )
    .orderBy(asc(events.timestamp))
    .limit(200_000);

  const buyers = new Set<string>();
  const streams = new Map<string, string[]>();

  for (const row of rows) {
    if (!row.personId) continue;
    if (row.eventName === "purchase_completed") buyers.add(row.personId);

    const path = streams.get(row.personId) ?? [];
    // Collapse immediate repeats: three form_submitted in a row is one step.
    if (path[path.length - 1] !== row.eventName) path.push(row.eventName);
    streams.set(row.personId, path);
  }

  const counts = new Map<string, { count: number; buyers: number }>();

  for (const [personId, path] of streams) {
    if (onlyBuyers && !buyers.has(personId)) continue;

    const key = path.slice(0, maxSteps).join(" → ");
    const existing = counts.get(key) ?? { count: 0, buyers: 0 };
    existing.count += 1;
    if (buyers.has(personId)) existing.buyers += 1;
    counts.set(key, existing);
  }

  const total = [...counts.values()].reduce((sum, c) => sum + c.count, 0);

  return [...counts.entries()]
    .map(([path, stats]) => ({
      path,
      steps: path.split(" → "),
      people: stats.count,
      buyers: stats.buyers,
      share: total === 0 ? 0 : stats.count / total,
    }))
    .sort((a, b) => b.people - a.people)
    .slice(0, 25);
}
