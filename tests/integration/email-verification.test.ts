import { hash } from "bcryptjs";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import {
  requestEmailVerification,
  verifyEmailToken,
  hashVerificationToken,
  VERIFICATION_TTL_MS,
} from "@/server/email-verification";
import {
  authorizeVerifiedCredentials,
  isVerifiedUser,
} from "@/server/verified-credentials";
import { registerUser } from "@/server/actions/onboarding";
import { hashResetToken } from "@/server/password-recovery";
import { resetPassword } from "@/server/actions/password";
import { users, verificationTokens } from "@/server/db/schema";
import { closeDatabase, prepareDatabase, testDb, truncateAll } from "./setup";

const mail = vi.hoisted(() => ({
  configured: true,
  send: vi.fn(),
  allowed: true,
}));
// Auth.js needs the Next runtime; its error contract is exercised in Playwright.
vi.mock("next-auth", () => ({
  CredentialsSignin: class CredentialsSignin extends Error {
    code = "credentials";
    type = "CredentialsSignin";
  },
}));
vi.mock("@/server/email", () => ({
  emailConfigured: () => mail.configured,
  sendEmail: mail.send,
}));
vi.mock("@/server/rate-limit", () => ({
  checkRateLimit: async () => ({ allowed: mail.allowed }),
}));
vi.mock("@/server/tenancy", () => ({
  requireOrgRole: vi.fn(),
  requireUser: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
beforeAll(prepareDatabase);
beforeEach(async () => {
  mail.configured = true;
  mail.allowed = true;
  mail.send.mockReset().mockResolvedValue(undefined);
  await truncateAll();
});
afterAll(closeDatabase);
const email = "verify@example.test";
function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [k, v] of Object.entries(values)) data.set(k, v);
  return data;
}
async function create(verified = false) {
  const [user] = await testDb
    .insert(users)
    .values({
      email,
      passwordHash: await hash("local-password-123", 10),
      emailVerifiedAt: verified ? new Date() : null,
    })
    .returning();
  return user;
}
function deliveredToken() {
  const body = mail.send.mock.calls.at(-1)![0];
  return new URL(
    body.text.match(/https?:\/\/\S+\/verify-email\?token=[a-f0-9]{64}/)![0],
  ).searchParams.get("token")!;
}

it("registers an unverified account and emails a purpose-bound hashed token", async () => {
  await expect(
    registerUser(
      null,
      form({ email: " VERIFY@EXAMPLE.TEST ", password: "local-password-123" }),
    ),
  ).rejects.toThrow("REDIRECT:/verify-email?notice=sent");
  const [user] = await testDb.select().from(users);
  expect(user.emailVerifiedAt).toBeNull();
  expect(user.email).toBe(email);
  const token = deliveredToken();
  const [record] = await testDb.select().from(verificationTokens);
  expect(record.token).toBe(hashVerificationToken(token));
  expect(record.token).not.toBe(token);
  expect(record.expires.getTime() - Date.now()).toBeGreaterThan(
    VERIFICATION_TTL_MS - 5000,
  );
  expect(mail.send.mock.calls[0][0].subject).toBe(
    "Business Native – E-mail-cím megerősítése",
  );
  expect(mail.send.mock.calls[0][0].text).toContain("24 óráig");
});
it("blocks login before confirmation, allows it afterwards, and prevents replay", async () => {
  const user = await create();
  await requestEmailVerification(email);
  const token = deliveredToken();
  await expect(
    authorizeVerifiedCredentials({ email, password: "local-password-123" }),
  ).rejects.toMatchObject({ code: "email_unverified" });
  expect(await isVerifiedUser(user.id)).toBe(false);
  expect(await verifyEmailToken(token)).toBe(true);
  expect(await isVerifiedUser(user.id)).toBe(true);
  expect(
    await authorizeVerifiedCredentials({
      email: email.toUpperCase(),
      password: "local-password-123",
    }),
  ).toMatchObject({ id: user.id, email });
  expect(await verifyEmailToken(token)).toBe(false);
});
it("rejects wrong passwords without revealing the verification state", async () => {
  await create();
  expect(
    await authorizeVerifiedCredentials({
      email,
      password: "incorrect-password",
    }),
  ).toBeNull();
  expect(
    await authorizeVerifiedCredentials({
      email: "absent@example.test",
      password: "incorrect-password",
    }),
  ).toBeNull();
});
it("rejects expired, malformed and password recovery tokens", async () => {
  await create();
  const token = "a".repeat(64);
  await testDb
    .insert(verificationTokens)
    .values({
      identifier: email,
      token: hashVerificationToken(token),
      expires: new Date(Date.now() - 1000),
    });
  await testDb
    .insert(verificationTokens)
    .values({
      identifier: email,
      token: hashResetToken("b".repeat(64)),
      expires: new Date(Date.now() + 60000),
    });
  for (const value of [token, "b".repeat(64), "invalid", ""])
    expect(await verifyEmailToken(value)).toBe(false);
  expect((await testDb.select().from(users))[0].emailVerifiedAt).toBeNull();
});
it("atomically consumes a link during concurrent confirmations", async () => {
  await create();
  await requestEmailVerification(email);
  const token = deliveredToken();
  expect(
    (
      await Promise.all([verifyEmailToken(token), verifyEmailToken(token)])
    ).sort(),
  ).toEqual([false, true]);
});
it("throttles parallel email requests and hides unknown/already verified accounts", async () => {
  await create();
  const results = await Promise.all([
    requestEmailVerification(email),
    requestEmailVerification(email),
  ]);
  expect(results).toEqual([{ ok: true }, { ok: true }]);
  expect(mail.send).toHaveBeenCalledTimes(1);
  expect(await requestEmailVerification("absent@example.test")).toEqual({
    ok: true,
  });
  await testDb
    .update(users)
    .set({ emailVerifiedAt: new Date() })
    .where(eq(users.email, email));
  expect(await requestEmailVerification(email)).toEqual({ ok: true });
  expect(mail.send).toHaveBeenCalledTimes(1);
});
it("removes failed email credentials and supports a retry without losing the account", async () => {
  mail.send.mockRejectedValueOnce(new Error("provider unavailable"));
  await expect(
    registerUser(null, form({ email, password: "local-password-123" })),
  ).rejects.toThrow("REDIRECT:/verify-email?notice=delivery-failed");
  expect(await testDb.select().from(users)).toHaveLength(1);
  expect(await testDb.select().from(verificationTokens)).toEqual([]);
  expect(await requestEmailVerification(email)).toEqual({ ok: true });
  expect(mail.send).toHaveBeenCalledTimes(2);
});
it("does not overwrite a pending account password by registering again", async () => {
  await create();
  const before = (await testDb.select().from(users))[0].passwordHash;
  expect(
    await registerUser(null, form({ email, password: "replacement-password" })),
  ).toMatchObject({ error: expect.any(String) });
  expect((await testDb.select().from(users))[0].passwordHash).toBe(before);
});
it("retains an earlier valid link when a replacement email cannot be sent", async () => {
  await create();
  const token = "c".repeat(64);
  await testDb
    .insert(verificationTokens)
    .values({
      identifier: email,
      token: hashVerificationToken(token),
      expires: new Date(Date.now() + 600000),
    });
  mail.send.mockRejectedValueOnce(new Error("provider unavailable"));
  expect(await requestEmailVerification(email)).toMatchObject({
    error: expect.any(String),
  });
  expect(await verifyEmailToken(token)).toBe(true);
});
it("does not generate credentials when delivery is unconfigured or throttled", async () => {
  await create();
  mail.configured = false;
  expect(await requestEmailVerification(email)).toMatchObject({
    error: expect.any(String),
  });
  mail.configured = true;
  mail.allowed = false;
  expect(await requestEmailVerification(email)).toMatchObject({
    error: expect.any(String),
  });
  expect(mail.send).not.toHaveBeenCalled();
  expect(await testDb.select().from(verificationTokens)).toEqual([]);
});

it("password recovery does not bypass the separate email verification gate", async () => {
  await create();
  const token = "d".repeat(64);
  await testDb
    .insert(verificationTokens)
    .values({
      identifier: email,
      token: hashResetToken(token),
      expires: new Date(Date.now() + 60000),
    });
  await expect(
    resetPassword(null, form({ token, password: "replacement-password" })),
  ).rejects.toThrow("REDIRECT:/login?reset=1");
  await expect(
    authorizeVerifiedCredentials({ email, password: "replacement-password" }),
  ).rejects.toMatchObject({ code: "email_unverified" });
});
