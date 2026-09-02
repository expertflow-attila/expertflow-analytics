import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { EventEnvelope } from "@/lib/events/schema";
import { ingestEvents, type IngestContext } from "@/server/ingest";
import { events, persons, sessions, touchpoints } from "@/server/db/schema";
import type { Db } from "@/server/db";

import {
  closeDatabase,
  createTenant,
  prepareDatabase,
  testDb,
  truncateAll,
} from "./setup";

const db = testDb as unknown as Db;

let ctx: IngestContext;
let projectId: string;

function envelope(overrides: Partial<EventEnvelope>): EventEnvelope {
  return {
    event_name: "page_view",
    event_version: 1,
    properties: {},
    ...overrides,
  } as EventEnvelope;
}

beforeAll(async () => {
  await prepareDatabase();
});

afterAll(async () => {
  await closeDatabase();
});

beforeEach(async () => {
  await truncateAll();
  const tenant = await createTenant("Acme");
  projectId = tenant.project.id;
  ctx = {
    organizationId: tenant.organization.id,
    projectId: tenant.project.id,
    baseCurrency: "EUR",
    selfHost: "acme.test",
    source: "sdk",
  };
});

describe("idempotency", () => {
  it("stores an event once no matter how many times it is sent", async () => {
    const payload = envelope({
      event_id: "evt_duplicate_check",
      anonymous_id: "anon_1",
    });

    const first = await ingestEvents(db, ctx, [payload]);
    const second = await ingestEvents(db, ctx, [payload]);
    const third = await ingestEvents(db, ctx, [payload, payload]);

    expect(first.accepted).toBe(1);
    expect(second.duplicates).toBe(1);
    expect(second.accepted).toBe(0);
    expect(third.duplicates).toBe(2);

    const stored = await testDb
      .select()
      .from(events)
      .where(eq(events.eventId, "evt_duplicate_check"));

    expect(stored).toHaveLength(1);
  });

  it("generates an id when the client omits one, so events are never lost", async () => {
    const result = await ingestEvents(db, ctx, [
      envelope({ anonymous_id: "anon_1" }),
      envelope({ anonymous_id: "anon_1" }),
    ]);

    expect(result.accepted).toBe(2);
  });
});

describe("identity resolution", () => {
  it("links anonymous history to the person and keeps later events attached", async () => {
    // The canonical journey: browse anonymously, identify, then buy.
    await ingestEvents(db, ctx, [
      envelope({
        event_id: "evt_anon_pageview",
        anonymous_id: "anon_journey",
        session_id: "sess_journey",
        utm: { source: "youtube" },
        page: { url: "https://acme.test/", path: "/" },
      }),
    ]);

    await ingestEvents(db, ctx, [
      envelope({
        event_id: "evt_identify_lead",
        event_name: "lead_created",
        anonymous_id: "anon_journey",
        session_id: "sess_journey",
        identify: { email: "buyer@example.com", name: "Buyer" },
      }),
    ]);

    await ingestEvents(db, ctx, [
      envelope({
        event_id: "evt_later_purchase",
        event_name: "purchase_completed",
        anonymous_id: "anon_journey",
        revenue: { amount: 1490, currency: "EUR" },
      }),
    ]);

    const [person] = await testDb
      .select()
      .from(persons)
      .where(eq(persons.email, "buyer@example.com"));

    expect(person).toBeDefined();

    const stored = await testDb
      .select({ eventId: events.eventId, personId: events.personId })
      .from(events)
      .where(eq(events.projectId, projectId));

    // All three — including the one that predates the identify call.
    expect(stored).toHaveLength(3);
    for (const row of stored) {
      expect(row.personId).toBe(person.id);
    }
  });

  it("back-fills sessions and touchpoints, not just events", async () => {
    await ingestEvents(db, ctx, [
      envelope({
        event_id: "evt_backfill_view",
        anonymous_id: "anon_backfill",
        session_id: "sess_backfill",
        utm: { source: "facebook", medium: "paid" },
      }),
    ]);

    await ingestEvents(db, ctx, [
      envelope({
        event_id: "evt_backfill_lead",
        event_name: "lead_created",
        anonymous_id: "anon_backfill",
        identify: { email: "late@example.com" },
      }),
    ]);

    const [person] = await testDb
      .select()
      .from(persons)
      .where(eq(persons.email, "late@example.com"));

    const [session] = await testDb
      .select()
      .from(sessions)
      .where(eq(sessions.sessionKey, "sess_backfill"));
    expect(session.personId).toBe(person.id);

    const linkedTouchpoints = await testDb
      .select()
      .from(touchpoints)
      .where(eq(touchpoints.anonymousId, "anon_backfill"));

    expect(linkedTouchpoints.length).toBeGreaterThan(0);
    for (const touchpoint of linkedTouchpoints) {
      expect(touchpoint.personId).toBe(person.id);
    }
  });

  it("merges two records when a second identifier proves they are one person", async () => {
    // Same human, two devices, discovered to be one via a shared email.
    await ingestEvents(db, ctx, [
      envelope({
        event_id: "evt_device_a",
        anonymous_id: "anon_device_a",
        identify: { user_id: "user-42" },
      }),
    ]);

    await ingestEvents(db, ctx, [
      envelope({
        event_id: "evt_device_b",
        anonymous_id: "anon_device_b",
        identify: { email: "same@example.com" },
      }),
    ]);

    let stored = await testDb
      .select()
      .from(persons)
      .where(eq(persons.projectId, projectId));
    expect(stored).toHaveLength(2);

    // An event carrying BOTH identifiers proves the two are the same person.
    await ingestEvents(db, ctx, [
      envelope({
        event_id: "evt_merge_proof",
        anonymous_id: "anon_device_a",
        identify: { user_id: "user-42", email: "same@example.com" },
      }),
    ]);

    stored = await testDb
      .select()
      .from(persons)
      .where(eq(persons.projectId, projectId));

    expect(stored).toHaveLength(1);
    expect(stored[0].email).toBe("same@example.com");
    expect(stored[0].externalUserId).toBe("user-42");

    // Every event from both devices now belongs to the survivor.
    const orphaned = await testDb
      .select()
      .from(events)
      .where(and(eq(events.projectId, projectId), eq(events.personId, stored[0].id)));
    expect(orphaned).toHaveLength(3);
  });

  it("never merges two people who only share a name", async () => {
    await ingestEvents(db, ctx, [
      envelope({
        event_id: "evt_namesake_one",
        anonymous_id: "anon_one",
        identify: { email: "a.smith@example.com", name: "Alex Smith" },
      }),
      envelope({
        event_id: "evt_namesake_two",
        anonymous_id: "anon_two",
        identify: { email: "alex.s@example.com", name: "Alex Smith" },
      }),
    ]);

    const stored = await testDb
      .select()
      .from(persons)
      .where(eq(persons.projectId, projectId));

    expect(stored).toHaveLength(2);
  });
});

describe("revenue handling", () => {
  it("converts major units to minor units on revenue events", async () => {
    await ingestEvents(db, ctx, [
      envelope({
        event_id: "evt_revenue_check",
        event_name: "purchase_completed",
        anonymous_id: "anon_rev",
        revenue: { amount: 49.9, currency: "EUR" },
      }),
    ]);

    const [stored] = await testDb
      .select()
      .from(events)
      .where(eq(events.eventId, "evt_revenue_check"));

    expect(stored.revenueMinor).toBe(4990);
    expect(stored.currency).toBe("EUR");
  });

  it("ignores revenue attached to a non-revenue event", async () => {
    await ingestEvents(db, ctx, [
      envelope({
        event_id: "evt_bad_revenue",
        event_name: "page_view",
        anonymous_id: "anon_rev",
        revenue: { amount: 9999, currency: "EUR" },
      }),
    ]);

    const [stored] = await testDb
      .select()
      .from(events)
      .where(eq(events.eventId, "evt_bad_revenue"));

    expect(stored.revenueMinor).toBeNull();
  });
});

describe("session handling", () => {
  it("keeps the original acquisition attributes as the session continues", async () => {
    await ingestEvents(db, ctx, [
      envelope({
        event_id: "evt_session_first",
        anonymous_id: "anon_sess",
        session_id: "sess_shared",
        utm: { source: "youtube" },
      }),
    ]);

    await ingestEvents(db, ctx, [
      envelope({
        event_id: "evt_session_second",
        anonymous_id: "anon_sess",
        session_id: "sess_shared",
      }),
    ]);

    const [stored] = await testDb
      .select()
      .from(sessions)
      .where(eq(sessions.sessionKey, "sess_shared"));

    expect(stored.eventCount).toBe(2);
    // Not overwritten by the second, untagged event.
    expect(stored.channel).toBe("Video");
    expect(stored.utmSource).toBe("youtube");
  });
});

describe("tenant isolation", () => {
  it("keeps two organizations' events completely separate", async () => {
    const other = await createTenant("Globex");
    const otherCtx: IngestContext = {
      organizationId: other.organization.id,
      projectId: other.project.id,
      baseCurrency: "USD",
      selfHost: "globex.test",
      source: "sdk",
    };

    await ingestEvents(db, ctx, [
      envelope({ event_id: "evt_acme_only", anonymous_id: "anon_acme" }),
    ]);
    await ingestEvents(db, otherCtx, [
      envelope({ event_id: "evt_globex_only", anonymous_id: "anon_globex" }),
    ]);

    const acmeEvents = await testDb
      .select()
      .from(events)
      .where(eq(events.projectId, projectId));
    const globexEvents = await testDb
      .select()
      .from(events)
      .where(eq(events.projectId, other.project.id));

    expect(acmeEvents.map((e) => e.eventId)).toEqual(["evt_acme_only"]);
    expect(globexEvents.map((e) => e.eventId)).toEqual(["evt_globex_only"]);
  });

  it("does not merge identical emails across projects", async () => {
    const other = await createTenant("Initech");
    const otherCtx: IngestContext = {
      organizationId: other.organization.id,
      projectId: other.project.id,
      baseCurrency: "EUR",
      selfHost: "initech.test",
      source: "sdk",
    };

    const identify = { email: "shared@example.com" };

    await ingestEvents(db, ctx, [
      envelope({ event_id: "evt_tenant_a", anonymous_id: "anon_a", identify }),
    ]);
    await ingestEvents(db, otherCtx, [
      envelope({ event_id: "evt_tenant_b", anonymous_id: "anon_b", identify }),
    ]);

    const all = await testDb
      .select()
      .from(persons)
      .where(eq(persons.email, "shared@example.com"));

    // One person per project. The same human at two customers of ours is two
    // separate records, and must never be joined.
    expect(all).toHaveLength(2);
    expect(new Set(all.map((p) => p.projectId)).size).toBe(2);
  });
});

describe("resilience", () => {
  it("does not let one bad event abort the rest of the batch", async () => {
    const result = await ingestEvents(db, ctx, [
      envelope({ event_id: "evt_batch_ok_1", anonymous_id: "anon_b" }),
      // A null byte is rejected by Postgres for text columns. Schema validation
      // catches this at the API edge, but the ingest service must survive a
      // bad row arriving from any caller without losing the whole batch.
      envelope({
        event_id: "evt_batch_bad",
        event_name: "bad\u0000name",
        anonymous_id: "anon_b",
      }),
      envelope({ event_id: "evt_batch_ok_2", anonymous_id: "anon_b" }),
    ]);

    expect(result.accepted).toBe(2);
    expect(result.rejected).toBe(1);

    const stored = await testDb
      .select()
      .from(events)
      .where(eq(events.projectId, projectId));
    expect(stored.map((e) => e.eventId).sort()).toEqual([
      "evt_batch_ok_1",
      "evt_batch_ok_2",
    ]);
  });

  it("clamps an event dated in the future to now", async () => {
    const future = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

    await ingestEvents(db, ctx, [
      envelope({
        event_id: "evt_future_dated",
        anonymous_id: "anon_f",
        timestamp: future.toISOString(),
      }),
    ]);

    const [stored] = await testDb
      .select()
      .from(events)
      .where(eq(events.eventId, "evt_future_dated"));

    expect(stored.timestamp.getTime()).toBeLessThanOrEqual(Date.now() + 1000);
  });
});
