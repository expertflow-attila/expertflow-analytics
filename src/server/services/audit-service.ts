import { db } from "@/db";
import { auditLogs } from "@/db/schema";

export type AuditInput = {
  organizationId: string; projectId?: string; actorUserId?: string; action: string;
  entityType: string; entityId?: string; metadata?: Record<string, unknown>;
};

export async function recordAudit(input: AuditInput) {
  await db.insert(auditLogs).values({ ...input, metadata: input.metadata ?? {} });
}
