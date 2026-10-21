import "dotenv/config";
import postgres from "postgres";

/** Repair legacy installations that predate the verification-token table.
 * This only creates the missing auth table; it does not modify user records.
 * Run with the intended deployment's DATABASE_URL, never a different project.
 */
async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL_REQUIRED");
  const sql = postgres(process.env.DATABASE_URL, {
    max: 1,
    prepare: false,
    connect_timeout: 20,
  });
  try {
    await sql.begin(async (tx) => {
      await tx`select pg_advisory_xact_lock(187421, 1)`;
      await tx`create table if not exists public.verification_tokens (
        identifier text not null,
        token text not null,
        expires timestamp with time zone not null,
        constraint verification_tokens_identifier_token_pk primary key(identifier, token)
      )`;
      await tx`select identifier, token, expires from public.verification_tokens limit 0`;
    });
    console.info("Auth schema ready: verification_tokens");
  } finally {
    await sql.end();
  }
}
main().catch((error) => {
  console.error("Auth schema setup failed", {
    code: typeof error?.code === "string" ? error.code : "SETUP_FAILED",
  });
  process.exitCode = 1;
});
