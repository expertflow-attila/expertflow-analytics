import {
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { FUNNEL_NODE_KINDS } from "./funnel-kinds";
import { id } from "./_helpers";
import { organizations, projects } from "./tenancy";

export const funnelModeEnum = pgEnum("funnel_mode", [
  /** B must be the very next tracked step. */
  "STRICT",
  /** B must follow A in order; unrelated events in between are allowed. */
  "ORDERED",
  /** B must simply occur after A within the window. */
  "FLEXIBLE",
]);

export const funnels = pgTable(
  "funnels",
  {
    id: id("fnl"),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    mode: funnelModeEnum("mode").notNull().default("ORDERED"),
    /** Conversion window in seconds. Always explicit, never implied. */
    conversionWindowSeconds: integer("conversion_window_seconds")
      .notNull()
      .default(60 * 60 * 24 * 30),
    templateKey: text("template_key"),
    isArchived: text("is_archived").notNull().default("false"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("funnels_project_idx").on(t.projectId)],
);

// Sourced from the shared constant so the database enum and the union used by
// client-safe modules cannot drift apart.
export const funnelNodeKindEnum = pgEnum("funnel_node_kind", FUNNEL_NODE_KINDS);

/**
 * `matchRule` is the contract between the visual builder and the calculation
 * engine. It is intentionally simple and fully serialisable, so the engine can
 * be unit-tested against fixtures without any UI.
 */
export type FunnelMatchRule = {
  eventName: string;
  filters?: Array<{
    field: string;
    op: "eq" | "neq" | "contains" | "startsWith" | "gt" | "lt" | "exists";
    value?: string | number;
  }>;
};

export const funnelNodes = pgTable(
  "funnel_nodes",
  {
    id: id("fnn"),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    funnelId: text("funnel_id")
      .notNull()
      .references(() => funnels.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    kind: funnelNodeKindEnum("kind").notNull().default("EVENT"),
    /** Position in the funnel sequence, 0-based. */
    stepIndex: integer("step_index").notNull(),
    matchRule: jsonb("match_rule").$type<FunnelMatchRule>().notNull(),

    /** Plan vs reality inputs — all optional, all user-supplied. */
    targetConversionRate: doublePrecision("target_conversion_rate"),
    expectedTraffic: integer("expected_traffic"),
    expectedRevenueMinor: integer("expected_revenue_minor"),

    /** Canvas coordinates for React Flow. */
    positionX: doublePrecision("position_x").notNull().default(0),
    positionY: doublePrecision("position_y").notNull().default(0),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("funnel_nodes_funnel_idx").on(t.funnelId, t.stepIndex)],
);

export const funnelEdges = pgTable(
  "funnel_edges",
  {
    id: id("fne"),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    funnelId: text("funnel_id")
      .notNull()
      .references(() => funnels.id, { onDelete: "cascade" }),
    sourceNodeId: text("source_node_id")
      .notNull()
      .references(() => funnelNodes.id, { onDelete: "cascade" }),
    targetNodeId: text("target_node_id")
      .notNull()
      .references(() => funnelNodes.id, { onDelete: "cascade" }),
    label: text("label"),
  },
  (t) => [index("funnel_edges_funnel_idx").on(t.funnelId)],
);

export const attributionModelEnum = pgEnum("attribution_model", [
  "FIRST_TOUCH",
  "LAST_TOUCH",
  "LINEAR",
  "U_SHAPED",
  "POSITION_BASED",
]);

export const attributionConfigs = pgTable(
  "attribution_configs",
  {
    id: id("atc"),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    model: attributionModelEnum("model").notNull().default("LAST_TOUCH"),
    windowDays: integer("window_days").notNull().default(90),
    /** Position-based weights; only read when model = POSITION_BASED. */
    firstTouchWeight: doublePrecision("first_touch_weight").notNull().default(0.4),
    leadTouchWeight: doublePrecision("lead_touch_weight").notNull().default(0.4),
    includeDirect: text("include_direct").notNull().default("true"),
    includeOrganic: text("include_organic").notNull().default("true"),
    revenueEventName: text("revenue_event_name")
      .notNull()
      .default("purchase_completed"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("attribution_configs_project_idx").on(t.projectId)],
);
