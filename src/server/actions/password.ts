"use server";

import { hash } from "bcryptjs";
import { and, eq, gt, like, ne, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";

import { db } from "@/server/db";
import { users, verificationTokens } from "@/server/db/schema";
import {
  createResetToken,
  hashResetToken,
  passwordEmailConfigured,
  RESET_TOKEN_PREFIX,
  RESET_TTL_MS,
  sendPasswordResetEmail,
} from "@/server/password-recovery";
import { checkRateLimit } from "@/server/rate-limit";

const requestSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
});

const resetSchema = z.object({
  token: z
    .string()
    .regex(
      /^[a-f0-9]{64}$/,
      "A visszaállítási hivatkozás érvénytelen vagy lejárt",
    ),
  password: z
    .string()
    .min(8, "Legalább 8 karaktert használj")
    .refine(
      (value) => Buffer.byteLength(value, "utf8") <= 72,
      "A jelszó legfeljebb 72 bájt hosszú lehet",
    ),
});

export type ActionResult = { error: string } | { ok: true };

/** Issue a short-lived, hashed recovery credential and deliver it by email. */
export async function requestPasswordReset(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = requestSchema.safeParse(
    {
      email: String(formData.get("email") ?? ""),
    },
    { error: z.locales.hu().localeError },
  );

  if (!parsed.success) {
    return { error: "Adj meg érvényes e-mail-címet" };
  }

  if (!passwordEmailConfigured())
    return {
      error:
        "A jelszó-visszaállító e-mailek küldése még nincs beállítva. Kérj segítséget a munkaterület rendszergazdájától.",
    };

  const email = parsed.data.email;
  const limit = await checkRateLimit(hashResetToken(email), {
    limit: 3,
    windowSeconds: 900,
  });
  if (!limit.allowed)
    return {
      error:
        "Túl sok visszaállítási kérés érkezett. Próbáld újra 15 perc múlva.",
    };

  const credential = createResetToken();
  const issued = await db.transaction(async (tx) => {
    // Serializes requests for the same address across serverless instances.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${email}))`);
    const [user] = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (!user) return false;
    const [recent] = await tx
      .select({ token: verificationTokens.token })
      .from(verificationTokens)
      .where(
        and(
          eq(verificationTokens.identifier, email),
          like(verificationTokens.token, `${RESET_TOKEN_PREFIX}%`),
          gt(
            verificationTokens.expires,
            new Date(Date.now() + RESET_TTL_MS - 60_000),
          ),
        ),
      )
      .limit(1);
    if (recent) return false;
    await tx
      .insert(verificationTokens)
      .values({
        identifier: email,
        token: credential.tokenHash,
        expires: credential.expires,
      });
    return true;
  });
  // Existing and unknown addresses receive the same public success response.
  if (!issued) return { ok: true };

  try {
    await sendPasswordResetEmail(email, credential.token);
  } catch {
    await db
      .delete(verificationTokens)
      .where(
        and(
          eq(verificationTokens.identifier, email),
          eq(verificationTokens.token, credential.tokenHash),
        ),
      );
    return {
      error:
        "A visszaállító levelet most nem sikerült elküldeni. Próbáld újra később.",
    };
  }
  // A successfully delivered replacement supersedes previous reset links.
  await db
    .delete(verificationTokens)
    .where(
      and(
        eq(verificationTokens.identifier, email),
        like(verificationTokens.token, `${RESET_TOKEN_PREFIX}%`),
        ne(verificationTokens.token, credential.tokenHash),
      ),
    );
  return { ok: true };
}

/**
 * Reset the password using a valid token.
 */
export async function resetPassword(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = resetSchema.safeParse(
    {
      token: String(formData.get("token") ?? ""),
      password: String(formData.get("password") ?? ""),
    },
    { error: z.locales.hu().localeError },
  );

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Érvénytelen adatok" };
  }

  const passwordHash = await hash(parsed.data.password, 10);
  const updated = await db.transaction(async (tx) => {
    // Claim the token atomically: concurrent submissions cannot both use it.
    const [record] = await tx
      .delete(verificationTokens)
      .where(
        and(
          eq(verificationTokens.token, hashResetToken(parsed.data.token)),
          gt(verificationTokens.expires, new Date()),
        ),
      )
      .returning();
    if (!record) return false;

    const changed = await tx
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.email, record.identifier))
      .returning({ id: users.id });
    await tx
      .delete(verificationTokens)
      .where(
        and(
          eq(verificationTokens.identifier, record.identifier),
          like(verificationTokens.token, `${RESET_TOKEN_PREFIX}%`),
        ),
      );
    return changed.length === 1;
  });

  if (!updated) {
    return { error: "A visszaállítási hivatkozás érvénytelen vagy lejárt" };
  }

  redirect("/login?reset=1");
}
