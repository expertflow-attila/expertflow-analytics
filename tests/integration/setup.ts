import "dotenv/config";

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { sql } from "drizzle-orm";

import * as schema from "@/server/db/schema";

/**
 * Integration tests run against a real Postgres database, never the dev one.
 * `TEST_DATABASE_URL` defaults to the `fios_test` database created by the
 * project's setup instructions.
 */
const url =
  process.env.TEST_DATABASE_URL ??
  "postgres://fios:fios@localhost:5432/fios_test";

const client = postgres(url, { max: 1, prepare: false });
export const testDb = drizzle(client, { schema });

let migrated = false;

export async function prepareDatabase() {
  if (!migrated) {
    await migrate(testDb, { migrationsFolder: "./drizzle" });
    migrated = true;
  }
  await truncateAll();
}

/**
 * Truncating rather than dropping keeps the schema warm between test files
 * while still guaranteeing each test starts from an empty database.
 */
export async function truncateAll() {
  await testDb.execute(sql`
    truncate table
      events, touchpoints, sessions, anonymous_identities, identity_links,
      refunds, payments, subscriptions, orders, ad_spend,
      funnel_edges, funnel_nodes, funnels, attribution_configs,
      insights, opportunities, alerts, experiments,
      ai_messages, ai_conversations, integrations, ingest_logs,
      daily_project_metrics, daily_channel_metrics,
      api_keys, audit_logs, persons, projects, memberships,
      organizations, users, accounts, verification_tokens
    restart identity cascade
  `);
}

export async function closeDatabase() {
  await client.end();
}

/** Creates an isolated organization + project, the unit every test needs. */
export async function createTenant(name: string) {
  const [organization] = await testDb
    .insert(schema.organizations)
    .values({ name, slug: name.toLowerCase().replace(/\s+/g, "-"), timezone: "UTC" })
    .returning();

  const [project] = await testDb
    .insert(schema.projects)
    .values({
      organizationId: organization.id,
      name: `${name} site`,
      slug: "site",
      baseCurrency: "EUR",
    })
    .returning();

  return { organization, project };
}
