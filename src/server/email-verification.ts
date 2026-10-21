import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, like, ne, sql } from "drizzle-orm";
import { env } from "@/env";
import { db } from "@/server/db";
import { users, verificationTokens } from "@/server/db/schema";
import { emailConfigured, sendEmail } from "@/server/email";
import { checkRateLimit } from "@/server/rate-limit";

export const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
export const VERIFICATION_PREFIX = "email-verification:";
export function hashVerificationToken(token: string): string {
  return VERIFICATION_PREFIX + createHash("sha256").update(token).digest("hex");
}

export async function requestEmailVerification(
  email: string,
): Promise<{ ok: true } | { error: string }> {
  if (!emailConfigured())
    return {
      error:
        "A megerősítő e-mailek küldése most nem érhető el. Próbáld újra később.",
    };
  const limit = await checkRateLimit(hashVerificationToken(email), {
    limit: 3,
    windowSeconds: 900,
  });
  if (!limit.allowed)
    return { error: "Túl sok kérés érkezett. Próbáld újra 15 perc múlva." };
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashVerificationToken(token);
  const issued = await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${`verify:${email}`}))`,
    );
    const [user] = await tx
      .select({ id: users.id, verified: users.emailVerifiedAt })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (!user || user.verified) return false;
    const [recent] = await tx
      .select({ token: verificationTokens.token })
      .from(verificationTokens)
      .where(
        and(
          eq(verificationTokens.identifier, email),
          like(verificationTokens.token, `${VERIFICATION_PREFIX}%`),
          gt(
            verificationTokens.expires,
            new Date(Date.now() + VERIFICATION_TTL_MS - 60_000),
          ),
        ),
      )
      .limit(1);
    if (recent) return false;
    await tx
      .insert(verificationTokens)
      .values({
        identifier: email,
        token: tokenHash,
        expires: new Date(Date.now() + VERIFICATION_TTL_MS),
      });
    return true;
  });
  if (!issued) return { ok: true };
  const url = new URL("/verify-email", env.NEXT_PUBLIC_APP_URL);
  url.searchParams.set("token", token);
  const link = url.toString();
  try {
    await sendEmail({
      to: email,
      subject: "Business Native – E-mail-cím megerősítése",
      text: `Erősítsd meg az e-mail-címedet a Business Native Analitika használatához.\n\n${link}\n\nNyisd meg a hivatkozást, majd kattints az E-mail-cím megerősítése gombra. A hivatkozás 24 óráig, egyszer használható. Ha nem te regisztráltál, hagyd figyelmen kívül ezt a levelet.`,
      html: `<div lang="hu"><h1>E-mail-cím megerősítése</h1><p>A Business Native Analitika használatához igazold az e-mail-címedet.</p><p><a href="${link}">E-mail-cím megerősítése</a></p><p>Nyisd meg a hivatkozást, majd kattints a megerősítés gombra. A link 24 óráig, egyszer használható. Ha nem te regisztráltál, hagyd figyelmen kívül ezt a levelet.</p></div>`,
      idempotencyKey: tokenHash,
      context: "email-verification",
    });
  } catch {
    await db
      .delete(verificationTokens)
      .where(
        and(
          eq(verificationTokens.identifier, email),
          eq(verificationTokens.token, tokenHash),
        ),
      );
    return {
      error:
        "A megerősítő levelet most nem sikerült elküldeni. Próbáld újra később.",
    };
  }
  await db
    .delete(verificationTokens)
    .where(
      and(
        eq(verificationTokens.identifier, email),
        like(verificationTokens.token, `${VERIFICATION_PREFIX}%`),
        ne(verificationTokens.token, tokenHash),
      ),
    );
  return { ok: true };
}

/** A GET never consumes the credential; confirmation requires a user POST. */
export async function verifyEmailToken(token: string): Promise<boolean> {
  if (!/^[a-f0-9]{64}$/.test(token)) return false;
  return db.transaction(async (tx) => {
    const [candidate] = await tx
      .select({ identifier: verificationTokens.identifier })
      .from(verificationTokens)
      .where(eq(verificationTokens.token, hashVerificationToken(token)))
      .limit(1);
    if (!candidate) return false;
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${`verify:${candidate.identifier}`}))`,
    );
    const [record] = await tx
      .delete(verificationTokens)
      .where(
        and(
          eq(verificationTokens.token, hashVerificationToken(token)),
          gt(verificationTokens.expires, new Date()),
        ),
      )
      .returning();
    if (!record) return false;
    const [user] = await tx
      .update(users)
      .set({ emailVerifiedAt: new Date(), updatedAt: new Date() })
      .where(eq(users.email, record.identifier))
      .returning({ id: users.id });
    await tx
      .delete(verificationTokens)
      .where(
        and(
          eq(verificationTokens.identifier, record.identifier),
          like(verificationTokens.token, `${VERIFICATION_PREFIX}%`),
        ),
      );
    return Boolean(user);
  });
}
