import { createHash, randomBytes } from "node:crypto";

import { env } from "@/env";

export const RESET_TTL_MS = 30 * 60 * 1000;
export const RESET_TOKEN_PREFIX = "password-reset:";

export function hashResetToken(token: string): string {
  return RESET_TOKEN_PREFIX + createHash("sha256").update(token).digest("hex");
}

export function createResetToken() {
  const token = randomBytes(32).toString("hex");
  return {
    token,
    tokenHash: hashResetToken(token),
    expires: new Date(Date.now() + RESET_TTL_MS),
  };
}

export function passwordEmailConfigured(): boolean {
  return Boolean(env.RESEND_API_KEY?.trim() && env.EMAIL_FROM?.trim());
}

/** Credentials and recovery links must never appear in application logs. */
export async function sendPasswordResetEmail(
  email: string,
  token: string,
): Promise<void> {
  if (!passwordEmailConfigured())
    throw new Error("PASSWORD_EMAIL_NOT_CONFIGURED");
  const url = new URL("/reset-password", env.NEXT_PUBLIC_APP_URL);
  url.searchParams.set("token", token);
  const link = url.toString();
  // Only this trusted, URL-encoded link is interpolated into the HTML.
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": hashResetToken(token),
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [email],
      subject: "Business Native – Jelszó visszaállítása",
      text: `Új jelszót kértél a Business Native Analitika fiókodhoz.\n\nÚj jelszó beállítása: ${link}\n\nA hivatkozás 30 percig, egyszer használható. Ha nem te kérted, hagyd figyelmen kívül ezt a levelet.`,
      html: `<div lang="hu"><h1>Jelszó visszaállítása</h1><p>Új jelszót kértél a Business Native Analitika fiókodhoz.</p><p><a href="${link}">Új jelszó beállítása</a></p><p>A hivatkozás 30 percig, egyszer használható. Ha nem te kérted, hagyd figyelmen kívül ezt a levelet.</p></div>`,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    const knownReasons = new Set([
      "validation_error",
      "missing_api_key",
      "invalid_api_key",
      "restricted_api_key",
      "rate_limit_exceeded",
      "application_error",
      "daily_quota_exceeded",
      "monthly_quota_exceeded",
    ]);
    console.error("password-recovery: delivery-rejected", {
      status: response.status,
      reason: knownReasons.has(result?.name) ? result.name : "unknown",
    });
    throw new Error("PASSWORD_EMAIL_DELIVERY_FAILED");
  }
  console.info("password-recovery: email-accepted", {
    messageId: typeof result?.id === "string" ? result.id : "unavailable",
  });
}
