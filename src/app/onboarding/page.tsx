import { redirect } from "next/navigation";
import { AuthCard, Field, SubmitButton } from "@/components/auth-card";
import { requireUser } from "@/lib/auth/require-user";
import { getFirstWorkspaceForUser } from "@/server/services/project-service";
import { onboardingAction } from "./actions";

const timezones = ["UTC", "Europe/Budapest", "Europe/London", "America/New_York", "America/Los_Angeles"];
export default async function OnboardingPage() {
  const user = await requireUser();
  const existing = await getFirstWorkspaceForUser(user.id);
  if (existing) redirect(`/app/${existing.organizationSlug}/${existing.projectSlug}/overview`);
  return <AuthCard title="Set up your workspace" subtitle="Analytics depends on correct timezone and currency boundaries. Choose these once, then adjust them in Settings if needed.">
    <form action={onboardingAction} className="grid gap-5">
      <Field label="Organization name" name="organizationName" />
      <Field label="Organization timezone" name="organizationTimezone"><select className="h-11 rounded-lg border border-foreground/15 bg-background px-3" name="organizationTimezone">{timezones.map((zone) => <option key={zone}>{zone}</option>)}</select></Field>
      <Field label="Project name" name="projectName" />
      <Field label="Project timezone" name="projectTimezone"><select className="h-11 rounded-lg border border-foreground/15 bg-background px-3" name="projectTimezone">{timezones.map((zone) => <option key={zone}>{zone}</option>)}</select></Field>
      <Field label="Base currency" name="baseCurrency"><select className="h-11 rounded-lg border border-foreground/15 bg-background px-3" name="baseCurrency" defaultValue="EUR">{["EUR", "USD", "GBP", "HUF"].map((currency) => <option key={currency}>{currency}</option>)}</select></Field>
      <SubmitButton>Create workspace</SubmitButton>
    </form>
  </AuthCard>;
}

