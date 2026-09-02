import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().url().startsWith("postgres"),
  AUTH_SECRET: z.string().min(32),
  APP_URL: z.string().url(),
});

export type AppEnv = z.infer<typeof schema>;

let cached: AppEnv | undefined;

export function getEnv(): AppEnv {
  if (!cached) {
    const result = schema.safeParse(process.env);
    if (!result.success) {
      throw new Error(`Invalid environment configuration: ${result.error.issues.map((issue) => issue.path.join(".")).join(", ")}`);
    }
    cached = result.data;
  }
  return cached;
}

