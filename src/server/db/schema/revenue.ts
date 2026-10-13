import {
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
import { persons } from "./tracking";

/**
 * Canonical revenue. When a server-side payment provider (Stripe) is
 * connected, browser purchase events are NOT treated as the source of truth —
 * they are reconciled against these rows.
 */
export const orderSourceEnum = pgEnum("order_source", [
  "STRIPE",
  "WEBHOOK",
  "CSV_IMPORT",
  "SDK",
  "API",
]);

export const orders = pgTable(
  "orders",
  {
    id: id("ord"),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    personId: text("person_id").references(() => persons.id, {
      onDelete: "set null",
    }),
    /** Provider-side id; makes webhook replay idempotent. */
    externalId: text("external_id"),
    source: orderSourceEnum("source").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    grossMinor: integer("gross_minor").notNull(),
    refundedMinor: integer("refunded_minor").notNull().default(0),
    currency: text("currency").notNull(),
    productName: text("product_name"),
    isRecurring: text("is_recurring").notNull().default("false"),
    /** Sequence number for this person, 1 = first purchase. */
    orderIndex: integer("order_index"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("orders_project_external_key").on(t.projectId, t.externalId),
    index("orders_project_time_idx").on(t.projectId, t.occurredAt),
    index("orders_person_time_idx").on(t.personId, t.occurredAt),
  ],
);

export const paymentStatusEnum = pgEnum("payment_status", [
  "SUCCEEDED",
  "FAILED",
  "PENDING",
  "REFUNDED",
  "PARTIALLY_REFUNDED",
]);

export const payments = pgTable(
  "payments",
  {
    id: id("pay"),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    orderId: text("order_id").references(() => orders.id, {
      onDelete: "cascade",
    }),
    personId: text("person_id").references(() => persons.id, {
      onDelete: "set null",
    }),
    externalId: text("external_id"),
    status: paymentStatusEnum("status").notNull(),
    amountMinor: integer("amount_minor").notNull(),
    currency: text("currency").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  },
  (t) => [
    uniqueIndex("payments_project_external_key").on(t.projectId, t.externalId),
    index("payments_project_time_idx").on(t.projectId, t.occurredAt),
  ],
);

export const refunds = pgTable(
  "refunds",
  {
    id: id("ref"),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    orderId: text("order_id").references(() => orders.id, {
      onDelete: "cascade",
    }),
    personId: text("person_id").references(() => persons.id, {
      onDelete: "set null",
    }),
    externalId: text("external_id"),
    amountMinor: integer("amount_minor").notNull(),
    currency: text("currency").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    reason: text("reason"),
  },
  (t) => [
    uniqueIndex("refunds_project_external_key").on(t.projectId, t.externalId),
    index("refunds_project_time_idx").on(t.projectId, t.occurredAt),
  ],
);

export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "ACTIVE",
  "PAST_DUE",
  "CANCELED",
  "TRIALING",
]);

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: id("sub"),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    personId: text("person_id").references(() => persons.id, {
      onDelete: "set null",
    }),
    externalId: text("external_id"),
    status: subscriptionStatusEnum("status").notNull(),
    /** Normalised to a monthly figure so MRR is a simple sum. */
    mrrMinor: integer("mrr_minor").notNull().default(0),
    currency: text("currency").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    canceledAt: timestamp("canceled_at", { withTimezone: true }),
    productName: text("product_name"),
  },
  (t) => [
    uniqueIndex("subs_project_external_key").on(t.projectId, t.externalId),
    index("subs_project_status_idx").on(t.projectId, t.status),
  ],
);

/**
 * Marketing spend. Without it CAC, ROAS and payback are reported as
 * "Unavailable" rather than guessed.
 */
export const adSpend = pgTable(
  "ad_spend",
  {
    id: id("spd"),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    date: timestamp("date", { withTimezone: true }).notNull(),
    channel: text("channel").notNull(),
    campaign: text("campaign"),
    amountMinor: integer("amount_minor").notNull(),
    currency: text("currency").notNull(),
    source: text("source").notNull().default("CSV_IMPORT"),
  },
  (t) => [
    index("ad_spend_project_date_idx").on(t.projectId, t.date),
    uniqueIndex("ad_spend_unique_key").on(
      t.projectId,
      t.date,
      t.channel,
      t.campaign,
    ),
  ],
);
