import { compare } from "bcryptjs";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";

import { requestPasswordReset, resetPassword } from "@/server/actions/password";
import { users, verificationTokens } from "@/server/db/schema";
import { closeDatabase, prepareDatabase, testDb, truncateAll } from "./setup";
import { hashResetToken, RESET_TTL_MS } from "@/server/password-recovery";

const mail = vi.hoisted(() => ({
  configured: false,
  allowed: true,
  send: vi.fn(),
}));
vi.mock("@/server/password-recovery", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/password-recovery")>()),
  passwordEmailConfigured: () => mail.configured,
  sendPasswordResetEmail: mail.send,
}));
vi.mock("@/server/rate-limit", () => ({
  checkRateLimit: async () => ({ allowed: mail.allowed }),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

beforeAll(prepareDatabase);
beforeEach(async () => {
  mail.configured = false;
  mail.allowed = true;
  mail.send.mockReset();
  mail.send.mockResolvedValue(undefined);
  await truncateAll();
});
afterAll(closeDatabase);

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

it("does not claim delivery or issue reset tokens without an email provider", async () => {
  await testDb.insert(users).values({ email: "reset@example.test" });
  const existing = await requestPasswordReset(
    null,
    form({ email: "reset@example.test" }),
  );
  const absent = await requestPasswordReset(
    null,
    form({ email: "absent@example.test" }),
  );
  expect(existing).toEqual(absent);
  expect(existing).toEqual({
    error: expect.stringContaining("nincs beállítva"),
  });
  expect(await testDb.select().from(verificationTokens)).toEqual([]);
});

it("rejects expired reset links without modifying the password", async () => {
  await testDb
    .insert(users)
    .values({ email: "reset@example.test", passwordHash: "unchanged" });
  await testDb.insert(verificationTokens).values({
    identifier: "reset@example.test",
    token: hashResetToken("a".repeat(64)),
    expires: new Date(Date.now() - 1000),
  });
  expect(
    await resetPassword(
      null,
      form({ token: "a".repeat(64), password: "new-password-123" }),
    ),
  ).toEqual({ error: expect.stringContaining("lejárt") });
  expect((await testDb.select().from(users))[0].passwordHash).toBe("unchanged");
});

it("consumes a valid reset token once, including concurrent submissions", async () => {
  await testDb
    .insert(users)
    .values({ email: "reset@example.test", passwordHash: "old" });
  await testDb.insert(verificationTokens).values({
    identifier: "reset@example.test",
    token: hashResetToken("b".repeat(64)),
    expires: new Date(Date.now() + 60000),
  });
  const results = await Promise.allSettled([
    resetPassword(
      null,
      form({ token: "b".repeat(64), password: "new-password-123" }),
    ),
    resetPassword(
      null,
      form({ token: "b".repeat(64), password: "new-password-123" }),
    ),
  ]);
  const redirects = results.filter((r) => r.status === "rejected");
  expect(redirects).toHaveLength(1);
  expect((redirects[0] as PromiseRejectedResult).reason.message).toBe(
    "REDIRECT:/login?reset=1",
  );
  expect(results.filter((r) => r.status === "fulfilled")).toEqual([
    {
      status: "fulfilled",
      value: { error: "A visszaállítási hivatkozás érvénytelen vagy lejárt" },
    },
  ]);
  expect(
    await compare(
      "new-password-123",
      (await testDb.select().from(users))[0].passwordHash!,
    ),
  ).toBe(true);
  expect(await testDb.select().from(verificationTokens)).toEqual([]);
});

it("delivers a one-time link while storing only its hash, and normalizes email", async () => {
  mail.configured = true;
  await testDb
    .insert(users)
    .values({ email: "reset@example.test", passwordHash: "old" });
  const result = await requestPasswordReset(
    null,
    form({ email: " RESET@EXAMPLE.TEST " }),
  );
  expect(result).toEqual({ ok: true });
  expect(mail.send).toHaveBeenCalledTimes(1);
  const [email, token] = mail.send.mock.calls[0];
  expect(email).toBe("reset@example.test");
  expect(token).toMatch(/^[a-f0-9]{64}$/);
  const [stored] = await testDb.select().from(verificationTokens);
  expect(stored.token).toBe(hashResetToken(token));
  expect(stored.token).not.toBe(token);
  expect(stored.expires.getTime() - Date.now()).toBeGreaterThan(
    RESET_TTL_MS - 5000,
  );
  expect(stored.expires.getTime() - Date.now()).toBeLessThanOrEqual(
    RESET_TTL_MS,
  );
  await expect(
    resetPassword(null, form({ token, password: "recovered-password-123" })),
  ).rejects.toThrow("REDIRECT:/login?reset=1");
  expect(
    await compare(
      "recovered-password-123",
      (await testDb.select().from(users))[0].passwordHash!,
    ),
  ).toBe(true);
  expect(await testDb.select().from(verificationTokens)).toEqual([]);
});

it("uses the same public response for existing and absent accounts", async () => {
  mail.configured = true;
  await testDb.insert(users).values({ email: "reset@example.test" });
  const existing = await requestPasswordReset(
    null,
    form({ email: "reset@example.test" }),
  );
  const absent = await requestPasswordReset(
    null,
    form({ email: "absent@example.test" }),
  );
  expect(existing).toEqual(absent);
  expect(mail.send).toHaveBeenCalledTimes(1);
});

it("serializes concurrent recovery requests across database connections", async () => {
  mail.configured = true;
  await testDb.insert(users).values({ email: "reset@example.test" });
  const results = await Promise.all([
    requestPasswordReset(null, form({ email: "reset@example.test" })),
    requestPasswordReset(null, form({ email: "reset@example.test" })),
  ]);
  expect(results).toEqual([{ ok: true }, { ok: true }]);
  expect(mail.send).toHaveBeenCalledTimes(1);
  expect(await testDb.select().from(verificationTokens)).toHaveLength(1);
});

it("removes a failed delivery credential while preserving an older working link", async () => {
  mail.configured = true;
  mail.send.mockRejectedValue(new Error("provider unavailable"));
  await testDb.insert(users).values({ email: "reset@example.test" });
  const previous = hashResetToken("c".repeat(64));
  await testDb
    .insert(verificationTokens)
    .values({
      identifier: "reset@example.test",
      token: previous,
      expires: new Date(Date.now() + 600_000),
    });
  const result = await requestPasswordReset(
    null,
    form({ email: "reset@example.test" }),
  );
  expect(result).toEqual({
    error: expect.stringContaining("nem sikerült elküldeni"),
  });
  expect(
    (await testDb.select().from(verificationTokens)).map((t) => t.token),
  ).toEqual([previous]);
});

it("rejects malformed and raw database credentials", async () => {
  await testDb
    .insert(users)
    .values({ email: "reset@example.test", passwordHash: "unchanged" });
  const hashed = hashResetToken("d".repeat(64));
  await testDb
    .insert(verificationTokens)
    .values({
      identifier: "reset@example.test",
      token: hashed,
      expires: new Date(Date.now() + 60_000),
    });
  for (const token of ["", "invalid", hashed]) {
    expect(
      await resetPassword(null, form({ token, password: "new-password-123" })),
    ).toEqual({ error: expect.stringContaining("érvénytelen") });
  }
  expect((await testDb.select().from(users))[0].passwordHash).toBe("unchanged");
});

it("reports throttling without claiming a new message was sent", async () => {
  mail.configured = true;
  mail.allowed = false;
  const result = await requestPasswordReset(
    null,
    form({ email: "reset@example.test" }),
  );
  expect(result).toEqual({ error: expect.stringContaining("Túl sok") });
  expect(mail.send).not.toHaveBeenCalled();
  expect(await testDb.select().from(verificationTokens)).toEqual([]);
});
