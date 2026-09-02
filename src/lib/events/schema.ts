import { z } from "zod";

/**
 * The normalised event envelope. Both the browser SDK and the server-side API
 * speak exactly this shape, so there is a single validation path into the
 * system.
 */
export const eventEnvelopeSchema = z.object({
  /** Client-supplied id. Required for idempotency; generated if omitted. */
  event_id: z.string().min(8).max(64).optional(),
  event_name: z
    .string()
    .min(1)
    .max(80)
    .regex(
      /^[a-z0-9_]+$/,
      "Event names must be lowercase snake_case (a-z, 0-9, _)",
    ),
  event_version: z.number().int().min(1).max(999).default(1),

  timestamp: z.string().datetime().optional(),

  anonymous_id: z.string().min(1).max(64).optional(),
  person_id: z.string().max(64).nullish(),
  session_id: z.string().min(1).max(64).optional(),

  /** Identity traits. Presence of `email` or `user_id` triggers resolution. */
  identify: z
    .object({
      email: z.string().email().optional(),
      user_id: z.string().max(128).optional(),
      name: z.string().max(200).optional(),
      stripe_customer_id: z.string().max(128).optional(),
      crm_contact_id: z.string().max(128).optional(),
      traits: z.record(z.string(), z.unknown()).optional(),
    })
    .optional(),

  page: z
    .object({
      url: z.string().max(2048).optional(),
      path: z.string().max(1024).optional(),
      referrer: z.string().max(2048).optional(),
      title: z.string().max(512).optional(),
    })
    .optional(),

  utm: z
    .object({
      source: z.string().max(200).optional(),
      medium: z.string().max(200).optional(),
      campaign: z.string().max(200).optional(),
      content: z.string().max(200).optional(),
      term: z.string().max(200).optional(),
    })
    .optional(),

  /**
   * Revenue is expressed in MAJOR units by clients (e.g. 49.90) and converted
   * to minor units on ingest. Storing minor units keeps all downstream
   * arithmetic in integers.
   */
  revenue: z
    .object({
      amount: z.number().finite().optional(),
      currency: z.string().length(3).optional(),
    })
    .optional(),

  properties: z.record(z.string(), z.unknown()).default({}),

  context: z
    .object({
      device_type: z.enum(["desktop", "mobile", "tablet", "other"]).optional(),
      browser: z.string().max(80).optional(),
      country: z.string().length(2).optional(),
      user_agent: z.string().max(512).optional(),
      locale: z.string().max(20).optional(),
    })
    .optional(),
});

export type EventEnvelope = z.infer<typeof eventEnvelopeSchema>;

export const eventBatchSchema = z.object({
  events: z.array(eventEnvelopeSchema).min(1).max(500),
  /** Browser clock skew correction, in milliseconds. */
  sent_at: z.string().datetime().optional(),
});

export type EventBatch = z.infer<typeof eventBatchSchema>;
