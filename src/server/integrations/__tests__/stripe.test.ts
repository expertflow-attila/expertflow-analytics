import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  buildEnvelopeFromMapping,
  readPath,
} from "@/server/integrations/generic-webhook";
import { verifyStripeSignature } from "@/server/integrations/stripe";

const SECRET = "whsec_test_secret";

function sign(body: string, timestamp: number, secret = SECRET): string {
  const digest = createHmac("sha256", secret)
    .update(`${timestamp}.${body}`, "utf8")
    .digest("hex");
  return `t=${timestamp},v1=${digest}`;
}

describe("stripe signature verification", () => {
  const body = JSON.stringify({ id: "evt_1", type: "charge.succeeded" });
  const now = 1_700_000_000;

  it("accepts a correctly signed payload", () => {
    expect(verifyStripeSignature(body, sign(body, now), SECRET, now)).toBe(true);
  });

  it("rejects a payload whose body was altered after signing", () => {
    const header = sign(body, now);
    const tampered = JSON.stringify({ id: "evt_1", type: "charge.refunded" });
    expect(verifyStripeSignature(tampered, header, SECRET, now)).toBe(false);
  });

  it("rejects a signature made with a different secret", () => {
    const header = sign(body, now, "whsec_wrong");
    expect(verifyStripeSignature(body, header, SECRET, now)).toBe(false);
  });

  it("rejects a replayed payload outside the tolerance window", () => {
    // Correctly signed, but an hour old: a captured request being replayed.
    const header = sign(body, now - 3600);
    expect(verifyStripeSignature(body, header, SECRET, now)).toBe(false);
  });

  it("accepts a payload inside the tolerance window", () => {
    const header = sign(body, now - 120);
    expect(verifyStripeSignature(body, header, SECRET, now)).toBe(true);
  });

  it("rejects a missing or malformed header", () => {
    expect(verifyStripeSignature(body, null, SECRET, now)).toBe(false);
    expect(verifyStripeSignature(body, "garbage", SECRET, now)).toBe(false);
    expect(verifyStripeSignature(body, `t=${now}`, SECRET, now)).toBe(false);
  });

  it("rejects everything when no secret is configured", () => {
    expect(verifyStripeSignature(body, sign(body, now), "", now)).toBe(false);
  });

  it("accepts when any one of several signatures matches", () => {
    // Stripe sends multiple v1 values while a secret is being rotated.
    const valid = sign(body, now).split(",")[1];
    const header = `t=${now},v1=${"0".repeat(64)},${valid}`;
    expect(verifyStripeSignature(body, header, SECRET, now)).toBe(true);
  });
});

describe("generic webhook mapping", () => {
  const payload = {
    event: { uuid: "cal_123", created_at: "2026-08-01T10:00:00.000Z" },
    invitee: { email: "Booked@Example.com", name: "Booked Person" },
    payment: { amount: "149.50", currency: "EUR" },
  };

  it("reads nested paths and misses safely", () => {
    expect(readPath(payload, "invitee.email")).toBe("Booked@Example.com");
    expect(readPath(payload, "invitee.missing.deeper")).toBeUndefined();
    expect(readPath(payload, "")).toBeUndefined();
  });

  it("builds a valid envelope from literals and paths", () => {
    const envelope = buildEnvelopeFromMapping(payload, {
      event_name: "=call_booked",
      event_id: "event.uuid",
      timestamp: "event.created_at",
      email: "invitee.email",
      name: "invitee.name",
      revenue_amount: "payment.amount",
      revenue_currency: "payment.currency",
      properties: { source: "=calendly" },
    }) as Record<string, unknown>;

    expect(envelope.event_name).toBe("call_booked");
    expect(envelope.event_id).toBe("cal_123");
    expect(envelope.identify).toMatchObject({ email: "Booked@Example.com" });
    // Numeric strings are coerced, so a provider sending "149.50" still works.
    expect(envelope.revenue).toEqual({ amount: 149.5, currency: "EUR" });
    expect(envelope.properties).toEqual({ source: "calendly" });
  });

  it("omits revenue when the mapped field is absent or unparseable", () => {
    const envelope = buildEnvelopeFromMapping(payload, {
      event_name: "=call_booked",
      revenue_amount: "payment.nothing",
    }) as Record<string, unknown>;

    expect(envelope.revenue).toBeUndefined();
  });

  it("omits identify when nothing identifies the person", () => {
    const envelope = buildEnvelopeFromMapping(payload, {
      event_name: "=page_view",
    }) as Record<string, unknown>;

    expect(envelope.identify).toBeUndefined();
  });
});
