import { env } from "@/env";

export function emailConfigured(): boolean {
  return Boolean(env.RESEND_API_KEY?.trim() && env.EMAIL_FROM?.trim());
}

export async function sendEmail(input: {
  to: string;
  subject: string;
  text: string;
  html: string;
  idempotencyKey: string;
  context: "password-recovery" | "email-verification";
}): Promise<void> {
  if (!emailConfigured()) throw new Error("EMAIL_NOT_CONFIGURED");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": input.idempotencyKey,
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [input.to],
      subject: input.subject,
      text: input.text,
      html: input.html,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    const reasons = new Set([
      "validation_error",
      "missing_api_key",
      "invalid_api_key",
      "restricted_api_key",
      "rate_limit_exceeded",
      "application_error",
      "daily_quota_exceeded",
      "monthly_quota_exceeded",
    ]);
    console.error(`${input.context}: delivery-rejected`, {
      status: response.status,
      reason: reasons.has(result?.name) ? result.name : "unknown",
    });
    throw new Error("PASSWORD_EMAIL_DELIVERY_FAILED");
  }
  console.info(`${input.context}: email-accepted`, {
    messageId: typeof result?.id === "string" ? result.id : "unavailable",
  });
}
