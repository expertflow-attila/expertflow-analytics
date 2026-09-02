import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createdAtColumn, idColumn, updatedAtColumn } from "./shared";

export const users = pgTable("users", {
  id: idColumn(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  image: text("image"),
  passwordHash: text("password_hash").notNull(),
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
  createdAt: createdAtColumn(),
  updatedAt: updatedAtColumn(),
}, (table) => [index("users_email_idx").on(table.email)]);

export type User = typeof users.$inferSelect;

