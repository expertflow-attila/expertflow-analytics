import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { organizationMemberships, organizations, projects } from "@/db/schema";
import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { hasPermission } from "@/lib/authorization/permissions";
import { onboardingSchema, slugify, updateOrganizationSchema } from "@/lib/validation/domain";
import { recordAudit } from "./audit-service";

async function availableOrganizationSlug(name: string) {
  const base = slugify(name);
  for (let i = 0; i < 100; i += 1) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    const [existing] = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.slug, candidate)).limit(1);
    if (!existing) return candidate;
  }
  throw new ConflictError("Could not create a unique organization slug.");
}

export async function createOnboardingWorkspace(userId: string, raw: unknown) {
  const input = onboardingSchema.parse(raw);
  const organizationSlug = await availableOrganizationSlug(input.organizationName);
  const result = await db.transaction(async (tx) => {
    const [organization] = await tx.insert(organizations).values({ name: input.organizationName, slug: organizationSlug, timezone: input.organizationTimezone, defaultCurrency: input.baseCurrency }).returning();
    await tx.insert(organizationMemberships).values({ organizationId: organization.id, userId, role: "OWNER" });
    const [project] = await tx.insert(projects).values({ organizationId: organization.id, name: input.projectName, slug: slugify(input.projectName), timezone: input.projectTimezone, baseCurrency: input.baseCurrency }).returning();
    return { organization, project };
  });
  await recordAudit({ organizationId: result.organization.id, actorUserId: userId, action: "ORGANIZATION_CREATED", entityType: "organization", entityId: result.organization.id });
  await recordAudit({ organizationId: result.organization.id, projectId: result.project.id, actorUserId: userId, action: "PROJECT_CREATED", entityType: "project", entityId: result.project.id });
  return result;
}

export async function listOrganizationsForUser(userId: string) {
  return db.select({ id: organizations.id, name: organizations.name, slug: organizations.slug, role: organizationMemberships.role })
    .from(organizationMemberships).innerJoin(organizations, eq(organizationMemberships.organizationId, organizations.id))
    .where(eq(organizationMemberships.userId, userId));
}

export async function updateOrganization(userId: string, organizationId: string, raw: unknown) {
  const input = updateOrganizationSchema.parse(raw);
  const [membership] = await db.select().from(organizationMemberships).where(and(eq(organizationMemberships.organizationId, organizationId), eq(organizationMemberships.userId, userId))).limit(1);
  if (!membership) throw new NotFoundError();
  if (!hasPermission(membership.role, "organization:manage")) throw new ForbiddenError();
  const [organization] = await db.update(organizations).set({ ...input, updatedAt: new Date() }).where(eq(organizations.id, organizationId)).returning();
  await recordAudit({ organizationId, actorUserId: userId, action: "ORGANIZATION_UPDATED", entityType: "organization", entityId: organizationId });
  return organization;
}
