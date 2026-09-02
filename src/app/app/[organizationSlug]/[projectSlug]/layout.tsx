import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth/require-user";
import { NotFoundError } from "@/lib/errors";
import { requireProjectContext } from "@/server/services/project-service";
import { listOrganizationsForUser } from "@/server/services/organization-service";
import { listProjectsForOrganization } from "@/server/services/project-service";

export const dynamic = "force-dynamic";
export default async function ProjectLayout({ children, params }: { children: ReactNode; params: Promise<{ organizationSlug: string; projectSlug: string }> }) {
  const user = await requireUser();
  const { organizationSlug, projectSlug } = await params;
  let context;
  try {
    context = await requireProjectContext(user.id, organizationSlug, projectSlug);
  } catch (error) { if (error instanceof NotFoundError) notFound(); throw error; }
  const [organizations, currentProjects] = await Promise.all([listOrganizationsForUser(user.id), listProjectsForOrganization(user.id, context.organization.id)]);
  const organizationOptions = await Promise.all(organizations.map(async (organization) => {
    const [firstProject] = await listProjectsForOrganization(user.id, organization.id);
    return { label: organization.name, value: organization.slug, url: firstProject ? `/app/${organization.slug}/${firstProject.slug}/overview` : "/onboarding" };
  }));
  const projectOptions = currentProjects.map((item) => ({ label: item.name, value: item.slug, url: `/app/${context.organization.slug}/${item.slug}/overview` }));
  return <AppShell organization={context.organization} project={context.project} role={context.role} organizationOptions={organizationOptions} projectOptions={projectOptions}>{children}</AppShell>;
}
