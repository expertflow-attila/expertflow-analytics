import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { attributionConfigs } from "@/server/db/schema";
import type { TenantContext } from "@/server/tenancy";

export async function loadAttributionSettings(ctx: TenantContext) {
  const [row] = await db
    .select()
    .from(attributionConfigs)
    .where(eq(attributionConfigs.projectId, ctx.projectId))
    .limit(1);
  return {
    model: row?.model ?? ("U_SHAPED" as const),
    windowDays: row?.windowDays ?? 90,
    includeDirect: (row?.includeDirect ?? "true") === "true",
    includeOrganic: (row?.includeOrganic ?? "true") === "true",
    firstTouchWeight: row?.firstTouchWeight ?? 0.4,
    leadTouchWeight: row?.leadTouchWeight ?? 0.4,
  };
}
