import type { Db } from "@/server/db";
import type { RevenueContext } from "@/server/revenue/service";

/**
 * The contract every inbound integration implements.
 *
 * Kept deliberately small: an integration's job is to authenticate a request
 * and translate it into the domain's own vocabulary. Nothing provider-specific
 * is allowed past `handleWebhook` — the revenue service and the analytics
 * engines must never learn what Stripe is.
 */
export interface IntegrationProvider {
  readonly id: string;
  readonly displayName: string;

  /**
   * Verifies the request really came from the provider. Returning false must
   * cause a rejection; a webhook endpoint that trusts its caller is an open
   * door to fabricated revenue.
   */
  verify(request: VerificationInput): Promise<boolean> | boolean;

  /** Translates a verified payload into domain writes. */
  handleWebhook(input: WebhookInput): Promise<WebhookOutcome>;
}

export type VerificationInput = {
  rawBody: string;
  headers: Headers;
  /** Decrypted per-project configuration, typically a signing secret. */
  config: Record<string, unknown>;
};

export type WebhookInput = {
  db: Db;
  ctx: RevenueContext;
  rawBody: string;
  headers: Headers;
  config: Record<string, unknown>;
};

export type WebhookOutcome = {
  /** Provider-side event id, used to make replays idempotent. */
  externalEventId: string | null;
  /** What the payload was recognised as; `ignored` is a success, not a failure. */
  action:
    | "order"
    | "payment"
    | "refund"
    | "subscription"
    | "event"
    | "ignored";
  detail: string;
};

const registry = new Map<string, IntegrationProvider>();

export function registerProvider(provider: IntegrationProvider): void {
  registry.set(provider.id, provider);
}

export function getProvider(id: string): IntegrationProvider | null {
  return registry.get(id) ?? null;
}

export function listProviders(): IntegrationProvider[] {
  return [...registry.values()];
}
