import {
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { id } from "./_helpers";
import { organizations, projects } from "./tenancy";

/**
 * A resolved human being. Anonymous visitors do NOT get a person row until a
 * deterministic identifier (email / user id / Stripe customer) appears.
 */
export const persons = pgTable(
  "persons",
  {
    id: id("per"),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    email: text("email"),
    name: text("name"),
    externalUserId: text("external_user_id"),
    stripeCustomerId: text("stripe_customer_id"),
    crmContactId: text("crm_contact_id"),
    traits: jsonb("traits").$type<Record<string, unknown>>(),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    /** Denormalised for fast Journey Explorer sorting; recomputed by a worker. */
    lifetimeRevenueMinor: integer("lifetime_revenue_minor").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("persons_project_idx").on(t.projectId),
    uniqueIndex("persons_project_email_key").on(t.projectId, t.email),
    index("persons_project_stripe_idx").on(t.projectId, t.stripeCustomerId),
    index("persons_project_external_idx").on(t.projectId, t.externalUserId),
  ],
);

/**
 * A browser/device identity. Many anonymous identities may resolve to one
 * person; an anonymous identity belongs to at most one person.
 */
export const anonymousIdentities = pgTable(
  "anonymous_identities",
  {
    id: id("ani"),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    anonymousId: text("anonymous_id").notNull(),
    personId: text("person_id").references(() => persons.id, {
      onDelete: "set null",
    }),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("anon_project_anonid_key").on(t.projectId, t.anonymousId),
    index("anon_person_idx").on(t.personId),
  ],
);

export const identityLinkMethodEnum = pgEnum("identity_link_method", [
  "EMAIL",
  "EXTERNAL_USER_ID",
  "STRIPE_CUSTOMER",
  "CRM_CONTACT",
  "MANUAL_MERGE",
]);

/**
 * Append-only audit trail of every identity resolution decision. Merges must
 * be explainable and reversible — never silently rewritten.
 */
export const identityLinks = pgTable(
  "identity_links",
  {
    id: id("idl"),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    personId: text("person_id")
      .notNull()
      .references(() => persons.id, { onDelete: "cascade" }),
    method: identityLinkMethodEnum("method").notNull(),
    identifier: text("identifier").notNull(),
    anonymousId: text("anonymous_id"),
    /** Person this record was merged away from, when applicable. */
    mergedFromPersonId: text("merged_from_person_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("identity_links_person_idx").on(t.personId),
    index("identity_links_project_idx").on(t.projectId),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: id("ses"),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    sessionKey: text("session_key").notNull(),
    anonymousId: text("anonymous_id").notNull(),
    personId: text("person_id").references(() => persons.id, {
      onDelete: "set null",
    }),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    entryPath: text("entry_path"),
    referrer: text("referrer"),
    utmSource: text("utm_source"),
    utmMedium: text("utm_medium"),
    utmCampaign: text("utm_campaign"),
    utmContent: text("utm_content"),
    utmTerm: text("utm_term"),
    /** Derived channel grouping (Paid Social, Organic Search, Direct, …). */
    channel: text("channel"),
    deviceType: text("device_type"),
    browser: text("browser"),
    country: text("country"),
    eventCount: integer("event_count").notNull().default(0),
  },
  (t) => [
    uniqueIndex("sessions_project_key_key").on(t.projectId, t.sessionKey),
    index("sessions_project_started_idx").on(t.projectId, t.startedAt),
    index("sessions_person_idx").on(t.personId),
  ],
);

export const events = pgTable(
  "events",
  {
    /** Client-supplied when available — this is what makes ingest idempotent. */
    eventId: text("event_id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),

    eventName: text("event_name").notNull(),
    eventVersion: integer("event_version").notNull().default(1),

    /** Always UTC. Day bucketing happens against the org timezone at query time. */
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true })
      .notNull()
      .defaultNow(),

    anonymousId: text("anonymous_id"),
    personId: text("person_id").references(() => persons.id, {
      onDelete: "set null",
    }),
    sessionKey: text("session_key"),

    pageUrl: text("page_url"),
    pagePath: text("page_path"),
    referrer: text("referrer"),

    utmSource: text("utm_source"),
    utmMedium: text("utm_medium"),
    utmCampaign: text("utm_campaign"),
    utmContent: text("utm_content"),
    utmTerm: text("utm_term"),
    channel: text("channel"),

    deviceType: text("device_type"),
    browser: text("browser"),
    country: text("country"),

    /** Minor units (cents). Only set for canonical revenue events. */
    revenueMinor: integer("revenue_minor"),
    currency: text("currency"),

    properties: jsonb("properties").$type<Record<string, unknown>>(),
    source: text("source").notNull().default("sdk"),
  },
  (t) => [
    index("events_project_ts_idx").on(t.projectId, t.timestamp),
    index("events_project_name_ts_idx").on(t.projectId, t.eventName, t.timestamp),
    index("events_person_ts_idx").on(t.personId, t.timestamp),
    index("events_anon_ts_idx").on(t.projectId, t.anonymousId, t.timestamp),
  ],
);

/**
 * A marketing touchpoint extracted from an event. Kept separate from `events`
 * so attribution never has to scan the full event firehose.
 */
export const touchpoints = pgTable(
  "touchpoints",
  {
    id: id("tp"),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    personId: text("person_id").references(() => persons.id, {
      onDelete: "cascade",
    }),
    anonymousId: text("anonymous_id"),
    sessionKey: text("session_key"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    channel: text("channel").notNull(),
    source: text("source"),
    medium: text("medium"),
    campaign: text("campaign"),
    content: text("content"),
    term: text("term"),
    landingPath: text("landing_path"),
    /** True when this touchpoint coincided with lead creation. */
    isLeadConversion: text("is_lead_conversion").notNull().default("false"),
  },
  (t) => [
    index("touchpoints_person_time_idx").on(t.personId, t.occurredAt),
    index("touchpoints_project_time_idx").on(t.projectId, t.occurredAt),
  ],
);

/**
 * Every ingest request, successful or not. Powers the Tracking Health engine
 * and gives users a real answer to "why is my data missing?".
 */
export const ingestLogs = pgTable(
  "ingest_logs",
  {
    id: id("ing"),
    projectId: text("project_id").references(() => projects.id, {
      onDelete: "cascade",
    }),
    receivedAt: timestamp("received_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    source: text("source").notNull(),
    accepted: integer("accepted").notNull().default(0),
    rejected: integer("rejected").notNull().default(0),
    duplicates: integer("duplicates").notNull().default(0),
    errorCode: text("error_code"),
    errorDetail: text("error_detail"),
    durationMs: doublePrecision("duration_ms"),
  },
  (t) => [index("ingest_logs_project_time_idx").on(t.projectId, t.receivedAt)],
);
