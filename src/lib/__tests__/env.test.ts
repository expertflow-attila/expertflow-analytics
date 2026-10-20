import { afterEach, expect, it, vi } from "vitest";

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

it("accepts the empty optional CRON_SECRET from .env.example", async () => {
  vi.stubEnv("CRON_SECRET", "");
  vi.resetModules();
  const { env } = await import("@/env");
  expect(env.CRON_SECRET).toBeUndefined();
});

it("rejects a configured but too short cron secret", async () => {
  vi.stubEnv("CRON_SECRET", "short");
  vi.resetModules();
  await expect(import("@/env")).rejects.toThrow();
});
