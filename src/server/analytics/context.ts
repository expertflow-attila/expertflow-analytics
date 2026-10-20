import { and, asc, eq } from "drizzle-orm";

import { db } from "@/server/db";
import { memberships, projects } from "@/server/db/schema";
import {
  requireProject,
  requireUser,
  type TenantContext,
} from "@/server/tenancy";
import type { DateRange } from "./queries";

/**
 * Resolves the project a page should render.
 *
 * Explicit id wins; otherwise the user's first project. Either way the result
 * comes back through `requireProject`, so a page can never bypass the
 * membership check by passing an id from the query string.
 */
export async function resolveProjectContext(
  projectId?: string,
): Promise<TenantContext> {
  if (projectId) return requireProject(projectId);

  const user = await requireUser();

  const [row] = await db
    .select({ id: projects.id })
    .from(projects)
    .innerJoin(
      memberships,
      and(
        eq(memberships.organizationId, projects.organizationId),
        eq(memberships.userId, user.id),
      ),
    )
    .orderBy(asc(projects.createdAt))
    .limit(1);

  if (!row) throw new Error("NO_PROJECT");

  return requireProject(row.id);
}

export const RANGE_PRESETS = {
  "7d": { label: "Last 7 days", days: 7 },
  "30d": { label: "Last 30 days", days: 30 },
  "90d": { label: "Last 90 days", days: 90 },
  "180d": { label: "Last 180 days", days: 180 },
} as const;

export type RangePreset = keyof typeof RANGE_PRESETS;

export function resolveRange(preset: string | undefined): {
  preset: RangePreset;
  range: DateRange;
} {
  const key: RangePreset =
    preset && Object.hasOwn(RANGE_PRESETS, preset)
      ? (preset as RangePreset)
      : "90d";

  const to = new Date();
  const from = new Date(to.getTime() - RANGE_PRESETS[key].days * 86_400_000);

  return { preset: key, range: { from, to } };
}

/**
 * True when the project holds generated sample data rather than measurements.
 *
 * Set explicitly by the seed script. It is NOT inferred from the event source:
 * seeded events and real browser events both arrive as "sdk", so inference
 * would label genuine data as demo — the opposite of the mistake that matters,
 * but still a lie on screen. Clearing the flag is a deliberate act in Settings.
 */
export async function isDemoDataset(ctx: TenantContext): Promise<boolean> {
  const [row] = await db
    .select({ settings: projects.settings })
    .from(projects)
    .where(eq(projects.id, ctx.projectId))
    .limit(1);

  return row?.settings?.demoDataset === true;
}
