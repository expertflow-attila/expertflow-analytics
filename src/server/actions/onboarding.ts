"use server";

import { hash } from "bcryptjs";
import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getTemplate } from "@/lib/funnel-templates";
import { generateApiKey, hashApiKey } from "@/server/crypto";
import { db } from "@/server/db";
import {
  apiKeys,
  attributionConfigs,
  auditLogs,
  funnelEdges,
  funnelNodes,
  funnels,
  memberships,
  organizations,
  projects,
  users,
} from "@/server/db/schema";
import { requireOrgRole, requireUser } from "@/server/tenancy";

/**
 * Account and workspace creation.
 *
 * Every mutation here is written to the audit log, because these are exactly
 * the actions someone investigating an incident needs to be able to trace.
 */

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Use at least 8 characters"),
  name: z.string().max(200).optional(),
});

export type ActionResult = { error: string } | { ok: true };

export async function registerUser(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = registerSchema.safeParse({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    name: String(formData.get("name") ?? "") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid details" };
  }

  const email = parsed.data.email.toLowerCase();

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing.length > 0) {
    // Deliberately vague, so this form cannot be used to enumerate which
    // addresses already have accounts.
    return { error: "That email cannot be used to create an account" };
  }

  await db.insert(users).values({
    email,
    name: parsed.data.name ?? null,
    passwordHash: await hash(parsed.data.password, 10),
  });

  redirect("/login?registered=1");
}

const workspaceSchema = z.object({
  organizationName: z.string().min(2).max(120),
  timezone: z.string().min(1).max(64),
  projectName: z.string().min(2).max(120),
  baseCurrency: z.string().length(3),
  templateKey: z.string().min(1),
});

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "workspace"
  );
}

/** Appends a suffix until the slug is free, so two "Acme"s can coexist. */
async function uniqueOrganizationSlug(base: string): Promise<string> {
  for (let attempt = 0; attempt < 50; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const taken = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.slug, candidate))
      .limit(1);
    if (taken.length === 0) return candidate;
  }
  return `${base}-${Date.now()}`;
}

export async function createWorkspace(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();

  const parsed = workspaceSchema.safeParse({
    organizationName: String(formData.get("organizationName") ?? ""),
    timezone: String(formData.get("timezone") ?? "UTC"),
    projectName: String(formData.get("projectName") ?? ""),
    baseCurrency: String(formData.get("baseCurrency") ?? "EUR").toUpperCase(),
    templateKey: String(formData.get("templateKey") ?? "blank"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid details" };
  }

  const template = getTemplate(parsed.data.templateKey);
  if (!template) return { error: "Unknown funnel template" };

  const slug = await uniqueOrganizationSlug(
    slugify(parsed.data.organizationName),
  );

  const [organization] = await db
    .insert(organizations)
    .values({
      name: parsed.data.organizationName,
      slug,
      timezone: parsed.data.timezone,
    })
    .returning();

  await db.insert(memberships).values({
    userId: user.id,
    organizationId: organization.id,
    role: "OWNER",
  });

  const [project] = await db
    .insert(projects)
    .values({
      organizationId: organization.id,
      name: parsed.data.projectName,
      slug: slugify(parsed.data.projectName),
      baseCurrency: parsed.data.baseCurrency,
    })
    .returning();

  const publishable = generateApiKey("pk");
  const secret = generateApiKey("sk");

  await db.insert(apiKeys).values([
    {
      organizationId: organization.id,
      projectId: project.id,
      type: "PUBLISHABLE",
      name: "Website",
      keyPlain: publishable,
      keyLast4: publishable.slice(-4),
    },
    {
      organizationId: organization.id,
      projectId: project.id,
      type: "SECRET",
      name: "Server events",
      keyHash: hashApiKey(secret),
      keyLast4: secret.slice(-4),
    },
  ]);

  await db.insert(attributionConfigs).values({
    organizationId: organization.id,
    projectId: project.id,
    model: "U_SHAPED",
    windowDays: 90,
  });

  await createFunnelFromTemplate({
    organizationId: organization.id,
    projectId: project.id,
    templateKey: template.key,
  });

  await db.insert(auditLogs).values({
    organizationId: organization.id,
    projectId: project.id,
    actorUserId: user.id,
    action: "workspace.created",
    targetType: "project",
    targetId: project.id,
    metadata: { template: template.key, timezone: parsed.data.timezone },
  });

  redirect("/integrations?created=1");
}

export async function createFunnelFromTemplate(params: {
  organizationId: string;
  projectId: string;
  templateKey: string;
}): Promise<string | null> {
  const template = getTemplate(params.templateKey);
  if (!template) return null;

  const [funnel] = await db
    .insert(funnels)
    .values({
      organizationId: params.organizationId,
      projectId: params.projectId,
      name: template.name,
      description: template.description,
      mode: template.mode,
      conversionWindowSeconds: template.conversionWindowDays * 86_400,
      templateKey: template.key,
    })
    .returning();

  const nodes = await db
    .insert(funnelNodes)
    .values(
      template.steps.map((step, index) => ({
        organizationId: params.organizationId,
        projectId: params.projectId,
        funnelId: funnel.id,
        name: step.name,
        kind: step.kind,
        stepIndex: index,
        matchRule: { eventName: step.eventName },
        // No target is set: a template cannot know what this business should
        // convert at, and an invented target produces fictional opportunities.
        targetConversionRate: null,
        positionX: 80 + index * 260,
        positionY: 160 + (index % 2) * 40,
      })),
    )
    .returning();

  if (nodes.length > 1) {
    await db.insert(funnelEdges).values(
      nodes.slice(0, -1).map((node, index) => ({
        organizationId: params.organizationId,
        projectId: params.projectId,
        funnelId: funnel.id,
        sourceNodeId: node.id,
        targetNodeId: nodes[index + 1].id,
      })),
    );
  }

  return funnel.id;
}

/** Clears the demo flag once a project holds real data. */
export async function clearDemoFlag(projectId: string): Promise<ActionResult> {
  const [project] = await db
    .select({ organizationId: projects.organizationId })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!project) return { error: "Project not found" };

  const { userId } = await requireOrgRole(project.organizationId, "ADMIN");

  await db
    .update(projects)
    .set({ settings: { demoDataset: false } })
    .where(
      and(
        eq(projects.id, projectId),
        eq(projects.organizationId, project.organizationId),
      ),
    );

  await db.insert(auditLogs).values({
    organizationId: project.organizationId,
    projectId,
    actorUserId: userId,
    action: "project.demo_flag_cleared",
    targetType: "project",
    targetId: projectId,
  });

  return { ok: true };
}
