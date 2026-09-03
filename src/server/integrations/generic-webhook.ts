import { createHmac, timingSafeEqual } from "node:crypto";

import { eventEnvelopeSchema } from "@/lib/events/schema";
import { ingestEvents } from "@/server/ingest";
import type {
  IntegrationProvider,
  VerificationInput,
  WebhookInput,
  WebhookOutcome,
} from "./provider";

/**
 * Generic webhook.
 *
 * Lets a project map an arbitrary JSON payload onto a Funnel Intelligence
 * event without anyone writing an adapter. The mapping is stored per project
 * and is intentionally simple: dot-paths into the payload, or literal values
 * written as `="something"`.
 *
 * Example config:
 * {
 *   "secret": "whsec_...",
 *   "signatureHeader": "x-signature",
 *   "mapping": {
 *     "event_name": "=call_booked",
 *     "email": "payload.invitee.email",
 *     "event_id": "payload.event.uuid",
 *     "timestamp": "payload.created_at"
 *   }
 * }
 */

export type WebhookMapping = {
  event_name: string;
  event_id?: string;
  timestamp?: string;
  email?: string;
  user_id?: string;
  name?: string;
  revenue_amount?: string;
  revenue_currency?: string;
  anonymous_id?: string;
  /** Extra fields copied into event properties, as `propertyName: path`. */
  properties?: Record<string, string>;
};

/** Reads `a.b.c` out of a parsed payload. Returns undefined on any miss. */
export function readPath(source: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((value, segment) => {
    if (value === null || typeof value !== "object") return undefined;
    return (value as Record<string, unknown>)[segment];
  }, source);
}

/** `=literal` means the literal string; anything else is a path lookup. */
function resolve(source: unknown, expression: string | undefined): unknown {
  if (!expression) return undefined;
  if (expression.startsWith("=")) return expression.slice(1);
  return readPath(source, expression);
}

function asString(value: unknown): string | undefined {
  if (typeof value === "string" && value.length > 0) return value;
  if (typeof value === "number") return String(value);
  return undefined;
}

export function buildEnvelopeFromMapping(
  payload: unknown,
  mapping: WebhookMapping,
): unknown {
  const email = asString(resolve(payload, mapping.email));
  const userId = asString(resolve(payload, mapping.user_id));
  const amount = resolve(payload, mapping.revenue_amount);

  const properties: Record<string, unknown> = {};
  for (const [key, path] of Object.entries(mapping.properties ?? {})) {
    const value = resolve(payload, path);
    if (value !== undefined) properties[key] = value;
  }

  const identify =
    email || userId
      ? {
          email,
          user_id: userId,
          name: asString(resolve(payload, mapping.name)),
        }
      : undefined;

  const numericAmount =
    typeof amount === "number"
      ? amount
      : typeof amount === "string" && amount.trim() !== ""
        ? Number(amount)
        : undefined;

  return {
    event_id: asString(resolve(payload, mapping.event_id)),
    event_name: asString(resolve(payload, mapping.event_name)),
    timestamp: asString(resolve(payload, mapping.timestamp)),
    anonymous_id: asString(resolve(payload, mapping.anonymous_id)),
    identify,
    revenue:
      numericAmount !== undefined && Number.isFinite(numericAmount)
        ? {
            amount: numericAmount,
            currency: asString(resolve(payload, mapping.revenue_currency)),
          }
        : undefined,
    properties,
  };
}

export const genericWebhookProvider: IntegrationProvider = {
  id: "webhook",
  displayName: "Generic webhook",

  verify({ rawBody, headers, config }: VerificationInput) {
    const secret = typeof config.secret === "string" ? config.secret : "";

    // A webhook with no configured secret is refused rather than trusted.
    // An unauthenticated endpoint that writes revenue is an open door.
    if (!secret) return false;

    const headerName =
      typeof config.signatureHeader === "string"
        ? config.signatureHeader
        : "x-signature";

    const provided = headers.get(headerName);
    if (!provided) return false;

    const expected = createHmac("sha256", secret)
      .update(rawBody, "utf8")
      .digest("hex");

    // Some senders prefix the digest; compare against the bare hex too.
    const candidate = provided.includes("=")
      ? (provided.split("=").pop() ?? provided)
      : provided;

    if (candidate.length !== expected.length) return false;
    return timingSafeEqual(
      Buffer.from(candidate, "utf8"),
      Buffer.from(expected, "utf8"),
    );
  },

  async handleWebhook({
    db,
    ctx,
    rawBody,
    config,
  }: WebhookInput): Promise<WebhookOutcome> {
    const mapping = config.mapping as WebhookMapping | undefined;
    if (!mapping?.event_name) {
      return {
        externalEventId: null,
        action: "ignored",
        detail: "No event_name mapping configured",
      };
    }

    const payload = JSON.parse(rawBody);
    const candidate = buildEnvelopeFromMapping(payload, mapping);
    const parsed = eventEnvelopeSchema.safeParse(candidate);

    if (!parsed.success) {
      throw new Error(
        `Mapped payload failed validation: ${parsed.error.issues
          .map((issue) => `${issue.path.join(".")} ${issue.message}`)
          .join("; ")}`,
      );
    }

    const result = await ingestEvents(
      db,
      {
        organizationId: ctx.organizationId,
        projectId: ctx.projectId,
        baseCurrency: ctx.baseCurrency,
        selfHost: null,
        source: "webhook",
      },
      [parsed.data],
    );

    return {
      externalEventId: parsed.data.event_id ?? null,
      action: result.accepted > 0 ? "event" : "ignored",
      detail:
        result.accepted > 0
          ? `Ingested ${parsed.data.event_name}`
          : "Duplicate event",
    };
  },
};
