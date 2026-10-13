/**
 * Drizzle schema skeleton for the production EventStore.
 * Matches the architecture boundary: tenant-scoped, idempotent by (project_id, external_id).
 */

export type EventRow = {
  id: string;
  projectId: string;
  externalId: string;
  eventName: string;
  timestamp: Date;
  personId?: string;
  anonymousId?: string;
  properties: Record<string, unknown>;
  createdAt: Date;
};

export type RevenueRow = {
  id: string;
  projectId: string;
  externalId: string;
  amount: number;
  currency: string;
  type: "purchase" | "refund" | "recurring" | "upsell";
  personId?: string;
  timestamp: Date;
};

export const schemaNote = "Replace with real drizzle-orm pgTable definitions and migrations when PostgreSQL is connected.";
