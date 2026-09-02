import { and, eq } from "drizzle-orm";

import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { memberships, organizations, projects } from "@/server/db/schema";

export type Role = "OWNER" | "ADMIN" | "ANALYST" | "VIEWER";

const RANK: Record<Role, number> = {
  VIEWER: 0,
  ANALYST: 1,
  ADMIN: 2,
  OWNER: 3,
};

export class AuthorizationError extends Error {
  constructor(
    message: string,
    readonly code: "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND",
  ) {
    super(message);
    this.name = "AuthorizationError";
  }
}

/**
 * The tenant context every analytics query must carry. There is deliberately
 * no way to construct one without going through a membership check.
 */
export type TenantContext = {
  userId: string;
  organizationId: string;
  projectId: string;
  role: Role;
  timezone: string;
  baseCurrency: string;
};

export async function requireUser(): Promise<{ id: string; email: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new AuthorizationError("Sign in required", "UNAUTHENTICATED");
  }
  return { id: session.user.id, email: session.user.email ?? "" };
}

export async function requireOrgRole(
  organizationId: string,
  minimum: Role = "VIEWER",
): Promise<{ userId: string; role: Role }> {
  const user = await requireUser();

  const [membership] = await db
    .select({ role: memberships.role })
    .from(memberships)
    .where(
      and(
        eq(memberships.userId, user.id),
        eq(memberships.organizationId, organizationId),
      ),
    )
    .limit(1);

  if (!membership) {
    // Deliberately NOT_FOUND rather than FORBIDDEN: never confirm that an
    // organization id exists to someone who is not a member of it.
    throw new AuthorizationError("Organization not found", "NOT_FOUND");
  }

  if (RANK[membership.role] < RANK[minimum]) {
    throw new AuthorizationError(
      `Requires ${minimum} role or higher`,
      "FORBIDDEN",
    );
  }

  return { userId: user.id, role: membership.role };
}

/**
 * Resolves a project id to a full tenant context, verifying membership of the
 * owning organization. Every server action and analytics query starts here.
 */
export async function requireProject(
  projectId: string,
  minimum: Role = "VIEWER",
): Promise<TenantContext> {
  const user = await requireUser();

  const [row] = await db
    .select({
      projectId: projects.id,
      organizationId: projects.organizationId,
      baseCurrency: projects.baseCurrency,
      role: memberships.role,
      timezone: organizations.timezone,
    })
    .from(projects)
    .innerJoin(
      memberships,
      and(
        eq(memberships.organizationId, projects.organizationId),
        eq(memberships.userId, user.id),
      ),
    )
    .innerJoin(organizations, eq(organizations.id, projects.organizationId))
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!row) {
    throw new AuthorizationError("Project not found", "NOT_FOUND");
  }

  if (RANK[row.role] < RANK[minimum]) {
    throw new AuthorizationError(
      `Requires ${minimum} role or higher`,
      "FORBIDDEN",
    );
  }

  return {
    userId: user.id,
    organizationId: row.organizationId,
    projectId: row.projectId,
    role: row.role,
    timezone: row.timezone,
    baseCurrency: row.baseCurrency,
  };
}

export function assertRole(ctx: TenantContext, minimum: Role): void {
  if (RANK[ctx.role] < RANK[minimum]) {
    throw new AuthorizationError(
      `Requires ${minimum} role or higher`,
      "FORBIDDEN",
    );
  }
}

export async function listUserOrganizations(userId: string) {
  return db
    .select({
      id: organizations.id,
      name: organizations.name,
      slug: organizations.slug,
      timezone: organizations.timezone,
      role: memberships.role,
    })
    .from(memberships)
    .innerJoin(organizations, eq(organizations.id, memberships.organizationId))
    .where(eq(memberships.userId, userId));
}
