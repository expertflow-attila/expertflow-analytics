import { redirect } from "next/navigation";

import { OnboardingForm } from "@/components/onboarding-form";
import { auth } from "@/server/auth";
import { listUserOrganizations } from "@/server/tenancy";

export const metadata = { title: "Set up your workspace" };
export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  // Someone who already has a workspace does not need this screen.
  const organizations = await listUserOrganizations(session.user.id);
  if (organizations.length > 0) redirect("/overview");

  return <OnboardingForm />;
}
