import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

import type { Db } from "@/server/db";
import {
  anonymousIdentities,
  events,
  identityLinks,
  orders,
  payments,
  persons,
  refunds,
  sessions,
  subscriptions,
  touchpoints,
} from "@/server/db/schema";

export type IdentifyInput = {
  email?: string;
  userId?: string;
  name?: string;
  stripeCustomerId?: string;
  crmContactId?: string;
  traits?: Record<string, unknown>;
};

/**
 * Deterministic identity resolution.
 *
 * The rules, in priority order:
 *   1. external user id  (strongest — the customer's own system said so)
 *   2. stripe customer id
 *   3. crm contact id
 *   4. email
 *
 * We never merge on name similarity, IP, or device fingerprint. A false merge
 * silently corrupts every downstream number and is effectively unrecoverable,
 * so the bar for merging is "an identifier the customer's systems asserted".
 *
 * Every decision is written to `identity_links`, making merges auditable and
 * reversible.
 */
export async function resolveIdentity(
  db: Db,
  params: {
    organizationId: string;
    projectId: string;
    anonymousId?: string | null;
    identify: IdentifyInput;
    occurredAt: Date;
  },
): Promise<string | null> {
  const { organizationId, projectId, anonymousId, identify, occurredAt } =
    params;

  const email = identify.email?.trim().toLowerCase();
  const candidates: Array<{
    method: "EXTERNAL_USER_ID" | "STRIPE_CUSTOMER" | "CRM_CONTACT" | "EMAIL";
    column: AnyPgColumn;
    value: string;
  }> = [];

  if (identify.userId) {
    candidates.push({
      method: "EXTERNAL_USER_ID",
      column: persons.externalUserId,
      value: identify.userId,
    });
  }
  if (identify.stripeCustomerId) {
    candidates.push({
      method: "STRIPE_CUSTOMER",
      column: persons.stripeCustomerId,
      value: identify.stripeCustomerId,
    });
  }
  if (identify.crmContactId) {
    candidates.push({
      method: "CRM_CONTACT",
      column: persons.crmContactId,
      value: identify.crmContactId,
    });
  }
  if (email) {
    candidates.push({ method: "EMAIL", column: persons.email, value: email });
  }

  if (candidates.length === 0) return null;

  // Find every existing person matching any supplied identifier.
  const matched: Array<{ personId: string; method: string }> = [];
  for (const candidate of candidates) {
    const [row] = await db
      .select({ id: persons.id })
      .from(persons)
      .where(
        and(
          eq(persons.projectId, projectId),
          eq(candidate.column, candidate.value),
        ),
      )
      .limit(1);
    if (row) matched.push({ personId: row.id, method: candidate.method });
  }

  const distinct = [...new Set(matched.map((m) => m.personId))];

  let personId: string;

  if (distinct.length === 0) {
    const [created] = await db
      .insert(persons)
      .values({
        organizationId,
        projectId,
        email: email ?? null,
        name: identify.name ?? null,
        externalUserId: identify.userId ?? null,
        stripeCustomerId: identify.stripeCustomerId ?? null,
        crmContactId: identify.crmContactId ?? null,
        traits: identify.traits ?? null,
        firstSeenAt: occurredAt,
        lastSeenAt: occurredAt,
      })
      .returning({ id: persons.id });
    personId = created.id;
  } else {
    // Two identifiers pointing at different people means the same human was
    // recorded twice. Keep the oldest record as canonical.
    const [survivor] = await db
      .select({ id: persons.id })
      .from(persons)
      .where(
        and(eq(persons.projectId, projectId), inArray(persons.id, distinct)),
      )
      .orderBy(persons.createdAt)
      .limit(1);

    personId = survivor.id;

    for (const loserId of distinct.filter((d) => d !== personId)) {
      await mergePersons(db, { projectId, survivorId: personId, loserId });
    }

    await db
      .update(persons)
      .set({
        email: email ?? sql`${persons.email}`,
        name: identify.name ?? sql`${persons.name}`,
        externalUserId: identify.userId ?? sql`${persons.externalUserId}`,
        stripeCustomerId:
          identify.stripeCustomerId ?? sql`${persons.stripeCustomerId}`,
        crmContactId: identify.crmContactId ?? sql`${persons.crmContactId}`,
        lastSeenAt: occurredAt,
        updatedAt: new Date(),
      })
      .where(eq(persons.id, personId));
  }

  // Record each identifier that produced this resolution.
  for (const candidate of candidates) {
    await db
      .insert(identityLinks)
      .values({
        organizationId,
        projectId,
        personId,
        method: candidate.method,
        identifier: candidate.value,
        anonymousId: anonymousId ?? null,
      })
      .onConflictDoNothing();
  }

  if (anonymousId) {
    await linkAnonymousIdentity(db, {
      organizationId,
      projectId,
      anonymousId,
      personId,
      occurredAt,
    });
  }

  return personId;
}

/**
 * Attaches a browser identity to a person and back-fills every event, session
 * and touchpoint that identity produced while still anonymous. Without this
 * back-fill, first-touch attribution would be blind to everything that
 * happened before the person gave their email.
 */
export async function linkAnonymousIdentity(
  db: Db,
  params: {
    organizationId: string;
    projectId: string;
    anonymousId: string;
    personId: string;
    occurredAt: Date;
  },
): Promise<void> {
  const { organizationId, projectId, anonymousId, personId, occurredAt } =
    params;

  await db
    .insert(anonymousIdentities)
    .values({
      organizationId,
      projectId,
      anonymousId,
      personId,
      firstSeenAt: occurredAt,
      lastSeenAt: occurredAt,
    })
    .onConflictDoUpdate({
      target: [anonymousIdentities.projectId, anonymousIdentities.anonymousId],
      set: { personId, lastSeenAt: occurredAt },
    });

  await db
    .update(events)
    .set({ personId })
    .where(
      and(
        eq(events.projectId, projectId),
        eq(events.anonymousId, anonymousId),
        isNull(events.personId),
      ),
    );

  await db
    .update(sessions)
    .set({ personId })
    .where(
      and(
        eq(sessions.projectId, projectId),
        eq(sessions.anonymousId, anonymousId),
        isNull(sessions.personId),
      ),
    );

  await db
    .update(touchpoints)
    .set({ personId })
    .where(
      and(
        eq(touchpoints.projectId, projectId),
        eq(touchpoints.anonymousId, anonymousId),
        isNull(touchpoints.personId),
      ),
    );
}

/**
 * Moves all history from `loserId` onto `survivorId`. Idempotent: running it
 * twice leaves the same result, because the loser has no rows left the second
 * time around.
 */
export async function mergePersons(
  db: Db,
  params: { projectId: string; survivorId: string; loserId: string },
): Promise<void> {
  const { projectId, survivorId, loserId } = params;
  if (survivorId === loserId) return;

  await db
    .update(events)
    .set({ personId: survivorId })
    .where(and(eq(events.projectId, projectId), eq(events.personId, loserId)));

  await db
    .update(sessions)
    .set({ personId: survivorId })
    .where(
      and(eq(sessions.projectId, projectId), eq(sessions.personId, loserId)),
    );

  await db
    .update(touchpoints)
    .set({ personId: survivorId })
    .where(
      and(eq(touchpoints.projectId, projectId), eq(touchpoints.personId, loserId)),
    );

  // Revenue must follow the person, or LTV silently drops on every merge.
  for (const table of [orders, payments, refunds, subscriptions] as const) {
    await db
      .update(table)
      .set({ personId: survivorId })
      .where(and(eq(table.projectId, projectId), eq(table.personId, loserId)));
  }

  await db
    .update(anonymousIdentities)
    .set({ personId: survivorId })
    .where(
      and(
        eq(anonymousIdentities.projectId, projectId),
        eq(anonymousIdentities.personId, loserId),
      ),
    );

  await db
    .update(identityLinks)
    .set({ personId: survivorId, mergedFromPersonId: loserId })
    .where(
      and(
        eq(identityLinks.projectId, projectId),
        eq(identityLinks.personId, loserId),
      ),
    );

  await db.delete(persons).where(eq(persons.id, loserId));
}
