import { index, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { createdAtColumn, idColumn, projectStatus, updatedAtColumn } from "./shared";

export const projects = pgTable("projects", {
  id: idColumn(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  timezone: text("timezone").notNull().default("UTC"),
  baseCurrency: text("base_currency").notNull().default("EUR"),
  status: projectStatus("status").notNull().default("ACTIVE"),
  createdAt: createdAtColumn(),
  updatedAt: updatedAtColumn(),
}, (table) => [
  index("projects_organization_idx").on(table.organizationId),
  uniqueIndex("projects_organization_slug_uq").on(table.organizationId, table.slug),
]);

