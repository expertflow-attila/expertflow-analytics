import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { organizationMemberships, organizations, projects } from "@/db/schema";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { hasPermission } from "@/lib/authorization/permissions";
import { slugify, updateProjectSchema } from "@/lib/validation/domain";
import { recordAudit } from "./audit-service";

export async function getFirstWorkspaceForUser(userId: string) {
  const [result] = await db.select({ organizationSlug: organizations.slug, projectSlug: projects.slug })
    .from(organizationMemberships)
    .innerJoin(organizations, eq(organizationMemberships.organizationId, organizations.id))
    .innerJoin(projects, and(eq(projects.organizationId, organizations.id), eq(projects.status, "ACTIVE")))
    .where(eq(organizationMemberships.userId, userId)).limit(1);
  return result;
}

export async function requireProjectContext(userId: string, organizationSlug: string, projectSlug: string) {
  const [context] = await db.select({
    organization: organizations, project: projects, role: organizationMemberships.role,
  }).from(organizationMemberships)
    .innerJoin(organizations, eq(organizationMemberships.organizationId, organizations.id))
    .innerJoin(projects, and(eq(projects.organizationId, organizations.id), eq(projects.slug, projectSlug), eq(projects.status, "ACTIVE")))
    .where(and(eq(organizationMemberships.userId, userId), eq(organizations.slug, organizationSlug))).limit(1);
  if (!context) throw new NotFoundError();
  return { userId, ...context };
}

export async function listProjectsForOrganization(userId: string, organizationId: string) {
  const [membership] = await db.select({ id: organizationMemberships.id }).from(organizationMemberships).where(and(eq(organizationMemberships.userId, userId), eq(organizationMemberships.organizationId, organizationId))).limit(1);
  if (!membership) throw new NotFoundError();
  return db.select().from(projects).where(and(eq(projects.organizationId, organizationId), eq(projects.status, "ACTIVE")));
}

export async function createProject(userId: string, organizationId: string, raw: { name: string; timezone: string; baseCurrency: string }) {
  const input = updateProjectSchema.parse(raw);
  const [membership] = await db.select().from(organizationMemberships).where(and(eq(organizationMemberships.userId, userId), eq(organizationMemberships.organizationId, organizationId))).limit(1);
  if (!membership) throw new NotFoundError();
  if (!hasPermission(membership.role, "project:manage")) throw new ForbiddenError();
  const [project] = await db.insert(projects).values({ organizationId, ...input, slug: `${slugify(input.name)}-${crypto.randomUUID().slice(0, 6)}` }).returning();
  await recordAudit({ organizationId, projectId: project.id, actorUserId: userId, action: "PROJECT_CREATED", entityType: "project", entityId: project.id });
  return project;
}

export async function updateProject(userId: string, organizationId: string, projectId: string, raw: unknown) {
  const input = updateProjectSchema.parse(raw);
  const [membership] = await db.select().from(organizationMemberships).where(and(eq(organizationMemberships.userId, userId), eq(organizationMemberships.organizationId, organizationId))).limit(1);
  if (!membership) throw new NotFoundError();
  if (!hasPermission(membership.role, "project:manage")) throw new ForbiddenError();
  const [project] = await db.update(projects).set({ ...input, updatedAt: new Date() }).where(and(eq(projects.id, projectId), eq(projects.organizationId, organizationId))).returning();
  if (!project) throw new NotFoundError();
  await recordAudit({ organizationId, projectId, actorUserId: userId, action: "PROJECT_UPDATED", entityType: "project", entityId: projectId });
  return project;
}

