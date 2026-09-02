import { and, eq, sql } from "drizzle-orm";

import { classifyChannel } from "@/lib/events/channel";
import type { EventEnvelope } from "@/lib/events/schema";
import { LEAD_EVENTS, REVENUE_EVENTS } from "@/lib/events/taxonomy";
import { newId } from "@/server/db/schema/_helpers";
import type { Db } from "@/server/db";
import {
  anonymousIdentities,
  events,
  ingestLogs,
  sessions,
  touchpoints,
} from "@/server/db/schema";
import { resolveIdentity } from "@/server/identity/resolve";

export type IngestContext = {
  organizationId: string;
  projectId: string;
  baseCurrency: string;
  selfHost: string | null;
  source: "sdk" | "api" | "webhook" | "import";
};

export type IngestResult = {
  accepted: number;
  duplicates: number;
  rejected: number;
  errors: Array<{ index: number; code: string; message: string }>;
};

/** Events dated further ahead than this are clock skew, not the future. */
const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;
/** Events older than this are almost always a replay or a broken importer. */
const MAX_PAST_AGE_MS = 400 * 24 * 60 * 60 * 1000;

/**
 * Ingests a batch of events.
 *
 * Guarantees:
 *  - idempotent per `event_id` (duplicates are counted, never double-stored)
 *  - a rejected event never aborts the rest of the batch
 *  - identity resolution runs after the event row exists, so back-fill sees it
 */
export async function ingestEvents(
  db: Db,
  ctx: IngestContext,
  envelopes: EventEnvelope[],
): Promise<IngestResult> {
  const startedAt = Date.now();
  const result: IngestResult = {
    accepted: 0,
    duplicates: 0,
    rejected: 0,
    errors: [],
  };

  for (const [index, envelope] of envelopes.entries()) {
    try {
      // Each event is atomic: either the event row, its session, its touchpoint
      // and its identity resolution all land, or none of them do. Without this
      // a mid-way failure leaves a stored event that the response reports as
      // rejected, and the client retries it into a duplicate.
      const outcome = await db.transaction((tx) =>
        ingestOne(tx as unknown as Db, ctx, envelope),
      );
      if (outcome === "duplicate") result.duplicates += 1;
      else result.accepted += 1;
    } catch (error) {
      result.rejected += 1;
      result.errors.push({
        index,
        code: "INGEST_FAILED",
        message: sanitiseErrorDetail(
          error instanceof Error ? error.message : "Unknown error",
        ),
      });
    }
  }

  await db.insert(ingestLogs).values({
    projectId: ctx.projectId,
    source: ctx.source,
    accepted: result.accepted,
    rejected: result.rejected,
    duplicates: result.duplicates,
    errorCode: result.errors[0]?.code ?? null,
    errorDetail: result.errors[0]?.message ?? null,
    durationMs: Date.now() - startedAt,
  });

  return result;
}

async function ingestOne(
  db: Db,
  ctx: IngestContext,
  envelope: EventEnvelope,
): Promise<"stored" | "duplicate"> {
  const eventId = envelope.event_id ?? newId("evt");
  const timestamp = normaliseTimestamp(envelope.timestamp);

  const referrer = envelope.page?.referrer ?? null;
  const channel = classifyChannel({
    utmSource: envelope.utm?.source,
    utmMedium: envelope.utm?.medium,
    referrer,
    selfHost: ctx.selfHost,
  });

  const revenueMinor = toMinorUnits(
    envelope.revenue?.amount,
    envelope.event_name,
  );

  // An SDK identifies once per person, then sends only the anonymous id on
  // every later event. Without this lookup each of those events — including
  // purchases — would be stored orphaned, and revenue would never reconcile
  // to a customer.
  const knownPersonId = envelope.anonymous_id
    ? await lookupPersonByAnonymousId(db, ctx.projectId, envelope.anonymous_id)
    : null;

  const inserted = await db
    .insert(events)
    .values({
      eventId,
      organizationId: ctx.organizationId,
      projectId: ctx.projectId,
      eventName: envelope.event_name,
      eventVersion: envelope.event_version,
      timestamp,
      anonymousId: envelope.anonymous_id ?? null,
      personId: knownPersonId,
      sessionKey: envelope.session_id ?? null,
      pageUrl: envelope.page?.url ?? null,
      pagePath: envelope.page?.path ?? derivePath(envelope.page?.url),
      referrer,
      utmSource: envelope.utm?.source ?? null,
      utmMedium: envelope.utm?.medium ?? null,
      utmCampaign: envelope.utm?.campaign ?? null,
      utmContent: envelope.utm?.content ?? null,
      utmTerm: envelope.utm?.term ?? null,
      channel,
      deviceType: envelope.context?.device_type ?? null,
      browser: envelope.context?.browser ?? null,
      country: envelope.context?.country ?? null,
      revenueMinor,
      currency: revenueMinor === null ? null : (envelope.revenue?.currency ?? ctx.baseCurrency),
      properties: envelope.properties,
      source: ctx.source,
    })
    .onConflictDoNothing({ target: events.eventId })
    .returning({ eventId: events.eventId });

  if (inserted.length === 0) return "duplicate";

  if (envelope.session_id && envelope.anonymous_id) {
    await upsertSession(db, ctx, envelope, {
      timestamp,
      channel,
      referrer,
      personId: knownPersonId,
    });
  }

  // A touchpoint is only meaningful when there is a channel signal to record.
  if (envelope.anonymous_id && channel !== "Unknown") {
    await db.insert(touchpoints).values({
      organizationId: ctx.organizationId,
      projectId: ctx.projectId,
      anonymousId: envelope.anonymous_id,
      personId: knownPersonId,
      sessionKey: envelope.session_id ?? null,
      occurredAt: timestamp,
      channel,
      source: envelope.utm?.source ?? null,
      medium: envelope.utm?.medium ?? null,
      campaign: envelope.utm?.campaign ?? null,
      content: envelope.utm?.content ?? null,
      term: envelope.utm?.term ?? null,
      landingPath: envelope.page?.path ?? derivePath(envelope.page?.url),
      isLeadConversion: LEAD_EVENTS.has(envelope.event_name) ? "true" : "false",
    });
  }

  if (envelope.identify) {
    const personId = await resolveIdentity(db, {
      organizationId: ctx.organizationId,
      projectId: ctx.projectId,
      anonymousId: envelope.anonymous_id ?? null,
      identify: {
        email: envelope.identify.email,
        userId: envelope.identify.user_id,
        name: envelope.identify.name,
        stripeCustomerId: envelope.identify.stripe_customer_id,
        crmContactId: envelope.identify.crm_contact_id,
        traits: envelope.identify.traits,
      },
      occurredAt: timestamp,
    });

    if (personId) {
      await db
        .update(events)
        .set({ personId })
        .where(eq(events.eventId, eventId));
    }
  }

  return "stored";
}

async function upsertSession(
  db: Db,
  ctx: IngestContext,
  envelope: EventEnvelope,
  derived: {
    timestamp: Date;
    channel: string;
    referrer: string | null;
    personId: string | null;
  },
): Promise<void> {
  await db
    .insert(sessions)
    .values({
      organizationId: ctx.organizationId,
      projectId: ctx.projectId,
      sessionKey: envelope.session_id!,
      anonymousId: envelope.anonymous_id!,
      personId: derived.personId,
      startedAt: derived.timestamp,
      endedAt: derived.timestamp,
      entryPath: envelope.page?.path ?? derivePath(envelope.page?.url),
      referrer: derived.referrer,
      utmSource: envelope.utm?.source ?? null,
      utmMedium: envelope.utm?.medium ?? null,
      utmCampaign: envelope.utm?.campaign ?? null,
      utmContent: envelope.utm?.content ?? null,
      utmTerm: envelope.utm?.term ?? null,
      channel: derived.channel,
      deviceType: envelope.context?.device_type ?? null,
      browser: envelope.context?.browser ?? null,
      country: envelope.context?.country ?? null,
      eventCount: 1,
    })
    .onConflictDoUpdate({
      target: [sessions.projectId, sessions.sessionKey],
      set: {
        // The session keeps its ORIGINAL acquisition attributes; only the
        // end time and counter move forward.
        //
        // `excluded` refers to the row this statement tried to insert, so the
        // timestamp is already a typed timestamptz. Passing the Date as a bound
        // parameter here instead makes Postgres compare timestamptz against an
        // untyped string literal and fail.
        endedAt: sql`greatest(${sessions.endedAt}, excluded.ended_at)`,
        eventCount: sql`${sessions.eventCount} + 1`,
      },
    });
}

/**
 * Makes an error message safe to store and return.
 *
 * A database error message quotes the offending parameters, so it can contain
 * the very bytes that caused the failure — a null byte in particular, which
 * Postgres rejects in text columns. Writing it back unmodified would make the
 * error log insert fail too, turning one bad event into a failed batch.
 */
function sanitiseErrorDetail(message: string): string {
  return message
    .replace(/\u0000/g, "\\u0000")
    .replace(/[\u0001-\u001f\u007f]/g, " ")
    .slice(0, 2000);
}

/** Resolves a browser identity to its person, if one has been linked. */
async function lookupPersonByAnonymousId(
  db: Db,
  projectId: string,
  anonymousId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ personId: anonymousIdentities.personId })
    .from(anonymousIdentities)
    .where(
      and(
        eq(anonymousIdentities.projectId, projectId),
        eq(anonymousIdentities.anonymousId, anonymousId),
      ),
    )
    .limit(1);

  return row?.personId ?? null;
}

function normaliseTimestamp(input: string | undefined): Date {
  const now = Date.now();
  if (!input) return new Date(now);

  const parsed = new Date(input).getTime();
  if (Number.isNaN(parsed)) return new Date(now);

  // Clamp rather than reject: a wrong clock should not lose the event, but it
  // must not be allowed to create data in the future either.
  if (parsed > now + MAX_FUTURE_SKEW_MS) return new Date(now);
  if (parsed < now - MAX_PAST_AGE_MS) return new Date(now - MAX_PAST_AGE_MS);

  return new Date(parsed);
}

function toMinorUnits(
  amount: number | undefined,
  eventName: string,
): number | null {
  if (amount === undefined || !Number.isFinite(amount)) return null;
  // Revenue on a non-revenue event is almost always a tagging mistake; storing
  // it would inflate every revenue figure in the product.
  if (!REVENUE_EVENTS.has(eventName)) return null;
  return Math.round(amount * 100);
}

function derivePath(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).pathname;
  } catch {
    return null;
  }
}

/** Resolves a publishable or secret API key to its project. */
export async function authenticateProjectKey(
  db: Db,
  rawKey: string,
  { requireSecret = false }: { requireSecret?: boolean } = {},
) {
  const { apiKeys, projects, organizations } = await import(
    "@/server/db/schema"
  );
  const { hashApiKey } = await import("@/server/crypto");

  const isSecret = rawKey.startsWith("sk_");
  if (requireSecret && !isSecret) return null;

  const predicate = isSecret
    ? eq(apiKeys.keyHash, hashApiKey(rawKey))
    : eq(apiKeys.keyPlain, rawKey);

  const [row] = await db
    .select({
      keyId: apiKeys.id,
      projectId: apiKeys.projectId,
      organizationId: apiKeys.organizationId,
      revokedAt: apiKeys.revokedAt,
      baseCurrency: projects.baseCurrency,
      timezone: organizations.timezone,
    })
    .from(apiKeys)
    .innerJoin(projects, eq(projects.id, apiKeys.projectId))
    .innerJoin(organizations, eq(organizations.id, apiKeys.organizationId))
    .where(and(predicate, eq(apiKeys.type, isSecret ? "SECRET" : "PUBLISHABLE")))
    .limit(1);

  if (!row || row.revokedAt) return null;

  await db
    .update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, row.keyId));

  return row;
}
