import { z } from "zod";

/**
 * Runtime environment validation.
 *
 * Fails fast at boot rather than surfacing `undefined` deep inside a query.
 * Optional integrations stay optional — the product must remain fully usable
 * without AI, without Redis and without Stripe.
 */
/**
 * `z.coerce.boolean()` is a trap here: `Boolean("false")` is `true`.
 * Env flags are strings, so parse them as strings.
 */
const boolFlag = (fallback: boolean) =>
  z
    .enum(["true", "false", "1", "0"])
    .default(fallback ? "true" : "false")
    .transform((v) => v === "true" || v === "1");

const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  DATABASE_URL: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url(),

  AUTH_SECRET: z.string().min(16),
  ENCRYPTION_KEY: z
    .string()
    .refine(
      (v) => Buffer.from(v, "base64").length === 32,
      "ENCRYPTION_KEY must be 32 bytes, base64 encoded",
    ),

  CRON_SECRET: z.string().min(16).optional(),
  REDIS_URL: z.string().url().optional(),

  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  OLLAMA_BASE_URL: z.string().url().optional(),

  FEATURE_AI_ANALYST: boolFlag(true),
  FEATURE_MCP_SERVER: boolFlag(false),
  FEATURE_CLICKHOUSE: boolFlag(false),
  FEATURE_OBSERVED_JOURNEY: boolFlag(true),

  CLICKHOUSE_URL: z.string().url().optional(),
  CLICKHOUSE_USER: z.string().optional(),
  CLICKHOUSE_PASSWORD: z.string().optional(),
  CLICKHOUSE_DATABASE: z.string().optional(),
});

/**
 * During `next build` no real secrets are present, and during unit tests we
 * want deterministic placeholders. Both cases get a permissive parse so the
 * build does not require production credentials.
 */
function load() {
  const parsed = schema.safeParse(process.env);

  if (!parsed.success) {
    const isBuild = process.env.NEXT_PHASE === "phase-production-build";
    if (isBuild || process.env.NODE_ENV === "test") {
      return schema.parse({
        ...process.env,
        DATABASE_URL:
          process.env.DATABASE_URL ?? "postgres://localhost:5432/placeholder",
        NEXT_PUBLIC_APP_URL:
          process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
        AUTH_SECRET: process.env.AUTH_SECRET ?? "build-time-placeholder-secret",
        ENCRYPTION_KEY:
          process.env.ENCRYPTION_KEY ?? Buffer.alloc(32).toString("base64"),
      });
    }

    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(
      `Invalid environment configuration:\n${issues}\n\nSee .env.example.`,
    );
  }

  return parsed.data;
}

export const env = load();

export const features = {
  aiAnalyst: env.FEATURE_AI_ANALYST,
  mcpServer: env.FEATURE_MCP_SERVER,
  clickhouse: env.FEATURE_CLICKHOUSE,
  observedJourney: env.FEATURE_OBSERVED_JOURNEY,
} as const;
