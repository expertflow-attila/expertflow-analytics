import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { id } from "./_helpers";

export const memberRoleEnum = pgEnum("member_role", [
  "OWNER",
  "ADMIN",
  "ANALYST",
  "VIEWER",
]);

export const users = pgTable(
  "users",
  {
    id: id("usr"),
    email: text("email").notNull(),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    name: text("name"),
    image: text("image"),
    /** bcrypt hash; null for OAuth-only accounts. */
    passwordHash: text("password_hash"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("users_email_key").on(t.email)],
);

/**
 * Auth.js adapter tables. Unused with the default credentials + JWT setup, but
 * present so enabling an OAuth provider is a config change, not a migration.
 */
export const accounts = pgTable(
  "accounts",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: text("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })],
);

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

export const organizations = pgTable(
  "organizations",
  {
    id: id("org"),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    /** IANA timezone. All analytics day-bucketing uses this, never the browser. */
    timezone: text("timezone").notNull().default("UTC"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("organizations_slug_key").on(t.slug)],
);

export const memberships = pgTable(
  "memberships",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    role: memberRoleEnum("role").notNull().default("VIEWER"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.organizationId] }),
    index("memberships_org_idx").on(t.organizationId),
  ],
);

export const dataRetentionEnum = pgEnum("data_retention", [
  "DAYS_30",
  "DAYS_90",
  "DAYS_180",
  "DAYS_365",
  "UNLIMITED",
]);

export const projects = pgTable(
  "projects",
  {
    id: id("prj"),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    /** ISO 4217. Events in other currencies are flagged, never silently converted. */
    baseCurrency: text("base_currency").notNull().default("EUR"),
    dataRetention: dataRetentionEnum("data_retention")
      .notNull()
      .default("DAYS_365"),
    anonymizeIp: text("anonymize_ip").notNull().default("true"),
    settings: jsonb("settings").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("projects_org_slug_key").on(t.organizationId, t.slug),
    index("projects_org_idx").on(t.organizationId),
  ],
);

export const apiKeyTypeEnum = pgEnum("api_key_type", [
  "PUBLISHABLE",
  "SECRET",
]);

export const apiKeys = pgTable(
  "api_keys",
  {
    id: id("key"),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    type: apiKeyTypeEnum("type").notNull(),
    name: text("name").notNull(),
    /**
     * Publishable keys are stored in clear (they ship in the browser snippet).
     * Secret keys are stored as a SHA-256 hash and shown exactly once.
     */
    keyPlain: text("key_plain"),
    keyHash: text("key_hash"),
    /** Last 4 chars, for identifying a key in the UI after creation. */
    keyLast4: text("key_last4").notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("api_keys_project_idx").on(t.projectId),
    uniqueIndex("api_keys_hash_key").on(t.keyHash),
    uniqueIndex("api_keys_plain_key").on(t.keyPlain),
  ],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: id("aud"),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    projectId: text("project_id").references(() => projects.id, {
      onDelete: "set null",
    }),
    actorUserId: text("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    action: text("action").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("audit_logs_org_created_idx").on(t.organizationId, t.createdAt)],
);
