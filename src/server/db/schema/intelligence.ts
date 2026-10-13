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
import { organizations, projects, users } from "./tenancy";

export const severityEnum = pgEnum("severity", ["INFO", "WARNING", "CRITICAL"]);

/**
 * Deterministic, rule-generated findings. The AI layer *reads* these; it never
 * invents them.
 */
export const insights = pgTable(
  "insights",
  {
    id: id("ins"),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    severity: severityEnum("severity").notNull().default("INFO"),
    /** Metric values behind the claim — always inspectable in the UI. */
    evidence: jsonb("evidence").$type<Record<string, unknown>>(),
    periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
    periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
    dismissedAt: timestamp("dismissed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("insights_project_created_idx").on(t.projectId, t.createdAt)],
);

export const confidenceEnum = pgEnum("confidence", [
  "HIGH",
  "MEDIUM",
  "LOW",
  "UNAVAILABLE",
]);

export const opportunities = pgTable(
  "opportunities",
  {
    id: id("opp"),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    funnelId: text("funnel_id"),
    nodeId: text("node_id"),
    title: text("title").notNull(),

    currentConversionRate: doublePrecision("current_conversion_rate"),
    targetConversionRate: doublePrecision("target_conversion_rate"),
    eligibleUsers: integer("eligible_users"),
    downstreamRevenuePerConversionMinor: integer(
      "downstream_revenue_per_conversion_minor",
    ),
    estimatedMonthlyUpsideMinor: integer("estimated_monthly_upside_minor"),

    /** Score components stay separate — the formula is never a black box. */
    revenueImpactScore: doublePrecision("revenue_impact_score"),
    reachScore: doublePrecision("reach_score"),
    persistenceScore: doublePrecision("persistence_score"),
    effortScore: doublePrecision("effort_score"),
    opportunityScore: doublePrecision("opportunity_score"),

    confidence: confidenceEnum("confidence").notNull().default("UNAVAILABLE"),
    confidenceReason: text("confidence_reason"),
    assumptions: jsonb("assumptions").$type<Record<string, unknown>>(),

    computedAt: timestamp("computed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("opportunities_project_score_idx").on(t.projectId, t.opportunityScore)],
);

export const alerts = pgTable(
  "alerts",
  {
    id: id("alr"),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    metric: text("metric").notNull(),
    title: text("title").notNull(),
    detail: text("detail").notNull(),
    severity: severityEnum("severity").notNull().default("WARNING"),
    observedValue: doublePrecision("observed_value"),
    expectedValue: doublePrecision("expected_value"),
    deviationSigma: doublePrecision("deviation_sigma"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
  },
  (t) => [index("alerts_project_time_idx").on(t.projectId, t.occurredAt)],
);

export const experimentStatusEnum = pgEnum("experiment_status", [
  "DRAFT",
  "RUNNING",
  "COMPLETED",
  "ABANDONED",
]);

export const experiments = pgTable(
  "experiments",
  {
    id: id("exp"),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    hypothesis: text("hypothesis"),
    funnelId: text("funnel_id"),
    nodeId: text("node_id"),
    metric: text("metric").notNull().default("conversion_rate"),
    baselineValue: doublePrecision("baseline_value"),
    targetValue: doublePrecision("target_value"),
    startDate: timestamp("start_date", { withTimezone: true }),
    endDate: timestamp("end_date", { withTimezone: true }),
    status: experimentStatusEnum("status").notNull().default("DRAFT"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("experiments_project_idx").on(t.projectId)],
);

export const aiConversations = pgTable(
  "ai_conversations",
  {
    id: id("aic"),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    title: text("title").notNull().default("New conversation"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("ai_conversations_project_idx").on(t.projectId)],
);

export const aiMessages = pgTable(
  "ai_messages",
  {
    id: id("aim"),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => aiConversations.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    content: text("content").notNull(),
    /**
     * Execution trace: which analytics tools ran, with what arguments, and what
     * they returned. This is the audit trail — not chain-of-thought.
     */
    toolTrace: jsonb("tool_trace").$type<
      Array<{
        tool: string;
        args: Record<string, unknown>;
        result: unknown;
        durationMs: number;
      }>
    >(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("ai_messages_conversation_idx").on(t.conversationId, t.createdAt)],
);

export const integrations = pgTable(
  "integrations",
  {
    id: id("int"),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    displayName: text("display_name").notNull(),
    /** AES-256-GCM encrypted blob. Never returned to the client. */
    encryptedConfig: text("encrypted_config"),
    status: text("status").notNull().default("CONNECTED"),
    lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
    lastEventAt: timestamp("last_event_at", { withTimezone: true }),
    eventsReceived: integer("events_received").notNull().default(0),
    errorCount: integer("error_count").notNull().default(0),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("integrations_project_provider_key").on(t.projectId, t.provider)],
);

/**
 * Materialised daily rollups. Dashboards read these; they never scan the raw
 * event table for period-over-period comparisons.
 */
export const dailyProjectMetrics = pgTable(
  "daily_project_metrics",
  {
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    visitors: integer("visitors").notNull().default(0),
    sessionsCount: integer("sessions_count").notNull().default(0),
    leads: integer("leads").notNull().default(0),
    customers: integer("customers").notNull().default(0),
    grossRevenueMinor: integer("gross_revenue_minor").notNull().default(0),
    refundedMinor: integer("refunded_minor").notNull().default(0),
    ordersCount: integer("orders_count").notNull().default(0),
    computedAt: timestamp("computed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("daily_project_metrics_key").on(t.projectId, t.date)],
);

export const dailyChannelMetrics = pgTable(
  "daily_channel_metrics",
  {
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    channel: text("channel").notNull(),
    visitors: integer("visitors").notNull().default(0),
    leads: integer("leads").notNull().default(0),
    customers: integer("customers").notNull().default(0),
    grossRevenueMinor: integer("gross_revenue_minor").notNull().default(0),
    computedAt: timestamp("computed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("daily_channel_metrics_key").on(t.projectId, t.date, t.channel)],
);
