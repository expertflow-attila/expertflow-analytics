import { index, pgTable, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { membershipRole, createdAtColumn, idColumn, updatedAtColumn } from "./shared";
import { users } from "./users";

export const organizationMemberships = pgTable("organization_memberships", {
  id: idColumn(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: membershipRole("role").notNull(),
  createdAt: createdAtColumn(),
  updatedAt: updatedAtColumn(),
}, (table) => [
  uniqueIndex("memberships_organization_user_uq").on(table.organizationId, table.userId),
  index("memberships_user_idx").on(table.userId),
]);

