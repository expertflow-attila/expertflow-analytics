"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { createProject, updateProject } from "@/server/services/project-service";
import { updateOrganization } from "@/server/services/organization-service";

export async function updateProjectAction(organizationId: string, projectId: string, path: string, formData: FormData) {
  const user = await requireUser();
  await updateProject(user.id, organizationId, projectId, Object.fromEntries(formData));
  revalidatePath(path);
}
export async function updateOrganizationAction(organizationId: string, path: string, formData: FormData) {
  const user = await requireUser();
  await updateOrganization(user.id, organizationId, Object.fromEntries(formData));
  revalidatePath(path);
}
export async function createProjectAction(organizationId: string, organizationSlug: string, formData: FormData) {
  const user = await requireUser();
  const project = await createProject(user.id, organizationId, Object.fromEntries(formData) as { name: string; timezone: string; baseCurrency: string });
  redirect(`/app/${organizationSlug}/${project.slug}/overview`);
}

