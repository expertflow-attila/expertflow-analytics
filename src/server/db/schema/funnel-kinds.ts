/**
 * Node kinds, kept separate from the Drizzle table definitions so client-safe
 * modules (funnel templates, UI labels) can import the union without pulling
 * the database layer into a browser bundle.
 */
export const FUNNEL_NODE_KINDS = [
  "SOURCE",
  "PAGE",
  "EVENT",
  "CONVERSION",
  "EMAIL",
  "WEBINAR",
  "CALL",
  "PURCHASE",
  "UPSELL",
  "SUBSCRIPTION",
  "CUSTOM",
] as const;

export type FunnelNodeKind = (typeof FUNNEL_NODE_KINDS)[number];
