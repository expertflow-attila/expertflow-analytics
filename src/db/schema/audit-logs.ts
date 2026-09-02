import { index, jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { projects } from "./projects";
import { createdAtColumn, idColumn } from "./shared";
import { users } from "./users";

export const auditLogs = pgTable("audit_logs", {
  id: idColumn(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
  actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id"),
  metadata: jsonb("metadata").notNull().default({}),
  ipAddress: text("ip_address"),
  createdAt: createdAtColumn(),
}, (table) => [index("audit_organization_created_idx").on(table.organizationId, table.createdAt)]);

