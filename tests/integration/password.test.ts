import { compare } from "bcryptjs";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";

import { requestPasswordReset, resetPassword } from "@/server/actions/password";
import { users, verificationTokens } from "@/server/db/schema";
import { closeDatabase, prepareDatabase, testDb, truncateAll } from "./setup";

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

beforeAll(prepareDatabase);
beforeEach(truncateAll);
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
    error: expect.stringContaining("not configured"),
  });
  expect(await testDb.select().from(verificationTokens)).toEqual([]);
});

it("rejects expired reset links without modifying the password", async () => {
  await testDb
    .insert(users)
    .values({ email: "reset@example.test", passwordHash: "unchanged" });
  await testDb.insert(verificationTokens).values({
    identifier: "reset@example.test",
    token: "expired",
    expires: new Date(Date.now() - 1000),
  });
  expect(
    await resetPassword(
      null,
      form({ token: "expired", password: "new-password-123" }),
    ),
  ).toEqual({ error: expect.stringContaining("expired") });
  expect((await testDb.select().from(users))[0].passwordHash).toBe("unchanged");
});

it("consumes a valid reset token once, including concurrent submissions", async () => {
  await testDb
    .insert(users)
    .values({ email: "reset@example.test", passwordHash: "old" });
  await testDb.insert(verificationTokens).values({
    identifier: "reset@example.test",
    token: "single-use",
    expires: new Date(Date.now() + 60000),
  });
  const results = await Promise.allSettled([
    resetPassword(
      null,
      form({ token: "single-use", password: "new-password-123" }),
    ),
    resetPassword(
      null,
      form({ token: "single-use", password: "new-password-123" }),
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
      value: { error: "This reset link is invalid or has expired" },
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
