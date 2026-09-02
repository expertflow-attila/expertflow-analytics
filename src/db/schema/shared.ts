import { pgEnum, timestamp, uuid } from "drizzle-orm/pg-core";

export const membershipRole = pgEnum("membership_role", ["OWNER", "ADMIN", "ANALYST", "VIEWER"]);
export const projectStatus = pgEnum("project_status", ["ACTIVE", "ARCHIVED"]);

export const idColumn = () => uuid("id").defaultRandom().primaryKey();
export const createdAtColumn = () => timestamp("created_at", { withTimezone: true }).defaultNow().notNull();
export const updatedAtColumn = () => timestamp("updated_at", { withTimezone: true }).defaultNow().notNull();

export type MembershipRole = (typeof membershipRole.enumValues)[number];

