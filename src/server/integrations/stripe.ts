import crypto from "crypto";

const TOLERANCE_SECONDS = 300;

export function verifyStripeSignature(
  payload: string,
  signatureHeader: string,
  secret: string,
  now = Math.floor(Date.now() / 1000)
): boolean {
  const parts = signatureHeader.split(",").reduce((acc, part) => {
    const [k, v] = part.split("=");
    if (k && v) acc[k] = v;
    return acc;
  }, {} as Record<string, string>);

  const timestamp = parseInt(parts.t || "0", 10);
  if (Math.abs(now - timestamp) > TOLERANCE_SECONDS) return false;

  const signed = `${timestamp}.${payload}`;
  const expected = crypto.createHmac("sha256", secret).update(signed).digest("hex");
  const provided = parts.v1 || "";

  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
  } catch {
    return false;
  }
}

export function parseStripeEvent(payload: string) {
  return JSON.parse(payload);
}
