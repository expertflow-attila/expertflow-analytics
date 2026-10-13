import { createHmac, timingSafeEqual } from "node:crypto";

import {
  recordOrder,
  recordPayment,
  recordRefund,
  recordSubscription,
  type CustomerRef,
} from "@/server/revenue/service";
import type {
  IntegrationProvider,
  VerificationInput,
  WebhookInput,
  WebhookOutcome,
} from "./provider";

/**
 * Stripe integration.
 *
 * Signature verification is implemented directly rather than through the
 * Stripe SDK. The scheme is small and stable, and a self-hosted analytics tool
 * should not carry a full payments SDK just to check an HMAC. Only the fields
 * this product actually uses are typed.
 */

/** Stripe rejects timestamps outside this window; so do we, to stop replays. */
const TOLERANCE_SECONDS = 300;

type StripeEvent = {
  id: string;
  type: string;
  created: number;
  data: { object: Record<string, unknown> };
};

export function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  if (!signatureHeader || !secret) return false;

  // Format: `t=1614556800,v1=hex,v1=hex`
  let timestamp: string | null = null;
  const signatures: string[] = [];

  for (const part of signatureHeader.split(",")) {
    const [key, value] = part.split("=", 2);
    if (key?.trim() === "t") timestamp = value?.trim() ?? null;
    if (key?.trim() === "v1" && value) signatures.push(value.trim());
  }

  if (!timestamp || signatures.length === 0) return false;

  const age = Math.abs(nowSeconds - Number(timestamp));
  if (!Number.isFinite(age) || age > TOLERANCE_SECONDS) return false;

  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`, "utf8")
    .digest("hex");

  // Constant-time compare; a plain === leaks the signature byte by byte.
  return signatures.some((candidate) => {
    if (candidate.length !== expected.length) return false;
    return timingSafeEqual(
      Buffer.from(candidate, "utf8"),
      Buffer.from(expected, "utf8"),
    );
  });
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function customerFrom(object: Record<string, unknown>): CustomerRef {
  const details = object.customer_details as
    | { email?: string; name?: string }
    | undefined;

  return {
    stripeCustomerId: asString(object.customer),
    email:
      asString(object.customer_email) ??
      asString(details?.email) ??
      asString((object.billing_details as { email?: string })?.email),
    name: asString(details?.name) ?? null,
  };
}

/** Stripe already reports amounts in minor units, so no conversion happens. */
function amountOf(object: Record<string, unknown>, ...keys: string[]): number {
  for (const key of keys) {
    const value = asNumber(object[key]);
    if (value !== null) return value;
  }
  return 0;
}

export const stripeProvider: IntegrationProvider = {
  id: "stripe",
  displayName: "Stripe",

  verify({ rawBody, headers, config }: VerificationInput) {
    const secret = typeof config.webhookSecret === "string" ? config.webhookSecret : "";
    return verifyStripeSignature(rawBody, headers.get("stripe-signature"), secret);
  },

  async handleWebhook({ db, ctx, rawBody }: WebhookInput): Promise<WebhookOutcome> {
    const event = JSON.parse(rawBody) as StripeEvent;
    const object = event.data?.object ?? {};
    const occurredAt = new Date((event.created ?? Date.now() / 1000) * 1000);
    const currency = (asString(object.currency) ?? ctx.baseCurrency).toUpperCase();
    const customer = customerFrom(object);

    switch (event.type) {
      case "checkout.session.completed": {
        const gross = amountOf(object, "amount_total", "amount_subtotal");
        if (asString(object.payment_status) !== "paid" || gross <= 0) {
          return {
            externalEventId: event.id,
            action: "ignored",
            detail: "Checkout session was not paid",
          };
        }

        await recordOrder(db, ctx, {
          externalId: asString(object.id) ?? event.id,
          occurredAt,
          grossMinor: gross,
          currency,
          productName: asString((object.metadata as Record<string, string>)?.product),
          isRecurring: asString(object.mode) === "subscription",
          customer,
          metadata: { stripeEvent: event.type },
        });

        return { externalEventId: event.id, action: "order", detail: "Checkout completed" };
      }

      case "payment_intent.succeeded":
      case "charge.succeeded": {
        await recordPayment(db, ctx, {
          externalId: asString(object.id) ?? event.id,
          status: "SUCCEEDED",
          amountMinor: amountOf(object, "amount_received", "amount"),
          currency,
          occurredAt,
          customer,
        });
        return { externalEventId: event.id, action: "payment", detail: "Payment succeeded" };
      }

      case "payment_intent.payment_failed":
      case "charge.failed": {
        await recordPayment(db, ctx, {
          externalId: asString(object.id) ?? event.id,
          status: "FAILED",
          amountMinor: amountOf(object, "amount"),
          currency,
          occurredAt,
          customer,
        });
        return { externalEventId: event.id, action: "payment", detail: "Payment failed" };
      }

      case "charge.refunded":
      case "refund.created": {
        const refunded = amountOf(object, "amount_refunded", "amount");
        if (refunded <= 0) {
          return { externalEventId: event.id, action: "ignored", detail: "Zero refund" };
        }

        await recordRefund(db, ctx, {
          externalId: `${asString(object.id) ?? event.id}_refund`,
          orderExternalId: asString(object.payment_intent) ?? asString(object.charge),
          amountMinor: refunded,
          currency,
          occurredAt,
          reason: asString(object.reason),
          customer,
        });
        return { externalEventId: event.id, action: "refund", detail: "Refund recorded" };
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const items = object.items as
          | { data?: Array<{ price?: { unit_amount?: number; recurring?: { interval?: string } } }> }
          | undefined;
        const price = items?.data?.[0]?.price;

        const unit = asNumber(price?.unit_amount) ?? 0;
        const interval = price?.recurring?.interval ?? "month";
        const mrr =
          interval === "year"
            ? Math.round(unit / 12)
            : interval === "week"
              ? Math.round((unit * 52) / 12)
              : unit;

        const status = asString(object.status);
        await recordSubscription(db, ctx, {
          externalId: asString(object.id) ?? event.id,
          status:
            event.type === "customer.subscription.deleted" || status === "canceled"
              ? "CANCELED"
              : status === "trialing"
                ? "TRIALING"
                : status === "past_due"
                  ? "PAST_DUE"
                  : "ACTIVE",
          mrrMinor:
            event.type === "customer.subscription.deleted" || status === "canceled"
              ? 0
              : mrr,
          currency,
          startedAt: new Date((asNumber(object.start_date) ?? event.created) * 1000),
          canceledAt: asNumber(object.canceled_at)
            ? new Date(asNumber(object.canceled_at)! * 1000)
            : null,
          customer,
        });

        return {
          externalEventId: event.id,
          action: "subscription",
          detail: `Subscription ${status ?? "updated"}`,
        };
      }

      case "invoice.payment_succeeded": {
        const gross = amountOf(object, "amount_paid");
        if (gross <= 0 || asString(object.billing_reason) === "subscription_create") {
          return {
            externalEventId: event.id,
            action: "ignored",
            detail: "Initial subscription invoice, already recorded at checkout",
          };
        }

        await recordOrder(db, ctx, {
          externalId: asString(object.id) ?? event.id,
          occurredAt,
          grossMinor: gross,
          currency,
          productName: "Subscription renewal",
          isRecurring: true,
          customer,
        });

        return { externalEventId: event.id, action: "order", detail: "Renewal invoice paid" };
      }

      default:
        return {
          externalEventId: event.id,
          action: "ignored",
          detail: `Unhandled event type ${event.type}`,
        };
    }
  },
};
