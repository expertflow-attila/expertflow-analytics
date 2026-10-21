"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import {
  requestEmailVerification,
  verifyEmailToken,
} from "@/server/email-verification";

export type VerificationResult = { ok: true } | { error: string };
export async function resendVerification(
  _: unknown,
  data: FormData,
): Promise<VerificationResult> {
  const parsed = z
    .string()
    .trim()
    .toLowerCase()
    .email()
    .max(254)
    .safeParse(data.get("email"));
  if (!parsed.success) return { error: "Adj meg érvényes e-mail-címet." };
  return requestEmailVerification(parsed.data);
}
export async function confirmEmail(
  _: unknown,
  data: FormData,
): Promise<VerificationResult> {
  if (!(await verifyEmailToken(String(data.get("token") ?? ""))))
    return {
      error:
        "A megerősítő hivatkozás érvénytelen, lejárt vagy már felhasználtad. Kérj új levelet.",
    };
  redirect("/login?verified=1");
}
