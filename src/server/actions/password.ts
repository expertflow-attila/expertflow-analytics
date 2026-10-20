"use server";

import { hash } from "bcryptjs";
import { and, eq, gt } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";

import { db } from "@/server/db";
import { users, verificationTokens } from "@/server/db/schema";

const requestSchema = z.object({
  email: z.string().email(),
});

const resetSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, "Legalább 8 karaktert használj"),
});

export type ActionResult = { error: string } | { ok: true };

/** Do not issue or log reset credentials until email delivery is configured. */
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

  return {
    error:
      "A jelszó-visszaállító e-mailek küldése még nincs beállítva. Kérj segítséget a munkaterület rendszergazdájától.",
  };
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
          eq(verificationTokens.token, parsed.data.token),
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
    return changed.length === 1;
  });

  if (!updated) {
    return { error: "A visszaállítási hivatkozás érvénytelen vagy lejárt" };
  }

  redirect("/login?reset=1");
}
