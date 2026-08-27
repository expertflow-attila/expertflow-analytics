import { z } from "zod";

export const eventSchema = z.object({
  event_id: z.string().min(8).max(160),
  event_name: z.string().regex(/^[a-z][a-z0-9_]{1,79}$/),
  event_version: z.number().int().positive().default(1),
  timestamp: z.string().datetime(),
  anonymous_id: z.string().max(160).optional(),
  person_id: z.string().max(160).optional(),
  session_id: z.string().max(160).optional(),
  page: z.object({ url: z.string().url().optional(), path: z.string().max(2048).optional(), referrer: z.string().max(4096).optional() }).optional(),
  utm: z.object({ source: z.string().max(160).optional(), medium: z.string().max(160).optional(), campaign: z.string().max(240).optional(), content: z.string().max(240).optional(), term: z.string().max(240).optional() }).optional(),
  properties: z.record(z.string(), z.unknown()).default({}),
  context: z.record(z.string(), z.unknown()).default({})
}).refine((event) => event.anonymous_id || event.person_id, { message: "anonymous_id or person_id is required" });

export const batchSchema = z.object({ events: z.array(eventSchema).min(1).max(100) });
export type FunnelEvent = z.infer<typeof eventSchema>;
