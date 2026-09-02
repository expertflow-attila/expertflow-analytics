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

const client =
  globalForDb.__fiosClient ??
  postgres(env.DATABASE_URL, {
    max: env.NODE_ENV === "production" ? 10 : 3,
    prepare: false,
  });

if (env.NODE_ENV !== "production") globalForDb.__fiosClient = client;

export const db = drizzle(client, { schema });
export { schema };
export type Db = typeof db;
