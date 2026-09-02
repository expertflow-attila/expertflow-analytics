import { pgTable, text } from "drizzle-orm/pg-core";
import { createdAtColumn, idColumn, updatedAtColumn } from "./shared";

export const organizations = pgTable("organizations", {
  id: idColumn(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  timezone: text("timezone").notNull().default("UTC"),
  defaultCurrency: text("default_currency").notNull().default("EUR"),
  createdAt: createdAtColumn(),
  updatedAt: updatedAtColumn(),
});

