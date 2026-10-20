"use server";

import { hash } from "bcryptjs";
import { and, eq, gt } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { nanoid } from "nanoid";

import { db } from "@/server/db";
import { users, verificationTokens } from "@/server/db/schema";

const requestSchema = z.object({
  email: z.string().email(),
});

const resetSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, "Use at least 8 characters"),
});

export type ActionResult = { error: string } | { ok: true };

/**
 * Request a password reset.
 * Always returns success to avoid email enumeration.
 */
export async function requestPasswordReset(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = requestSchema.safeParse({
    email: String(formData.get("email") ?? ""),
  });

  if (!parsed.success) {
    return { error: "Enter a valid email address" };
  }

  const email = parsed.data.email.toLowerCase();

  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (user) {
    const token = nanoid(32);
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await db
      .delete(verificationTokens)
      .where(eq(verificationTokens.identifier, email));

    await db.insert(verificationTokens).values({
      identifier: email,
      token,
      expires,
    });

    // TODO: send email with reset link
    // For now, log it. In production, wire to an email provider.
    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://expertflow-analytics.vercel.app"}/reset-password?token=${token}`;
    console.log(`[password-reset] ${email} -> ${resetUrl}`);
  }

  redirect("/forgot-password?sent=1");
}

/**
 * Reset the password using a valid token.
 */
export async function resetPassword(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = resetSchema.safeParse({
    token: String(formData.get("token") ?? ""),
    password: String(formData.get("password") ?? ""),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid details" };
  }

  const [record] = await db
    .select()
    .from(verificationTokens)
    .where(
      and(
        eq(verificationTokens.token, parsed.data.token),
        gt(verificationTokens.expires, new Date()),
      ),
    )
    .limit(1);

  if (!record) {
    return { error: "This reset link is invalid or has expired" };
  }

  const passwordHash = await hash(parsed.data.password, 10);

  await db
    .update(users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(users.email, record.identifier));

  await db
    .delete(verificationTokens)
    .where(eq(verificationTokens.token, parsed.data.token));

  redirect("/login?reset=1");
}
