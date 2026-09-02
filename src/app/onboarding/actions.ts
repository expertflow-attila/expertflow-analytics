"use server";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { createOnboardingWorkspace } from "@/server/services/organization-service";

export async function onboardingAction(formData: FormData) {
  const user = await requireUser();
  const result = await createOnboardingWorkspace(user.id, Object.fromEntries(formData));
  redirect(`/app/${result.organization.slug}/${result.project.slug}/overview`);
}

