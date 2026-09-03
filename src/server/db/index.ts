import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { env } from "@/env";
import * as schema from "./schema";

/**
 * A single pooled client per process. Next.js hot-reload would otherwise open
 * a new pool on every module reload and exhaust Postgres connections.
 */
const globalForDb = globalThis as unknown as {
  __fiosClient?: ReturnType<typeof postgres>;
};

/**
 * Under test the singleton points at the test database, so code that reaches
 * for `db` directly — the AI tools, for instance — is exercised against the
 * same schema the tests seed rather than a developer's working database.
 */
const connectionString =
  env.NODE_ENV === "test"
    ? (process.env.TEST_DATABASE_URL ?? env.DATABASE_URL)
    : env.DATABASE_URL;

const client =
  globalForDb.__fiosClient ??
  postgres(connectionString, {
    max: env.NODE_ENV === "production" ? 10 : 3,
    prepare: false,
  });

if (env.NODE_ENV !== "production") globalForDb.__fiosClient = client;

export const db = drizzle(client, { schema });
export { schema };
export type Db = typeof db;
