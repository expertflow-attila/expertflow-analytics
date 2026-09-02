import { Field, SubmitButton } from "@/components/auth-card";
import { requireUser } from "@/lib/auth/require-user";
import { requireProjectContext } from "@/server/services/project-service";
import { createProjectAction, updateOrganizationAction, updateProjectAction } from "./actions";

const zones = ["UTC", "Europe/Budapest", "Europe/London", "America/New_York", "America/Los_Angeles"];
export default async function SettingsPage({ params }: { params: Promise<{ organizationSlug: string; projectSlug: string }> }) {
  const user = await requireUser();
  const { organizationSlug, projectSlug } = await params;
  const context = await requireProjectContext(user.id, organizationSlug, projectSlug);
  const path = `/app/${organizationSlug}/${projectSlug}/settings`;
  const card = "rounded-2xl border border-foreground/10 bg-card p-6";
  return <main className="mx-auto max-w-5xl p-6 lg:p-10"><h1 className="text-3xl font-semibold">Settings</h1><p className="mt-2 text-muted-foreground">Workspace boundaries used by every future analytics calculation.</p>
    <div className="mt-8 grid gap-6 lg:grid-cols-2">
      <section className={card}><h2 className="text-xl font-medium">Project</h2><form action={updateProjectAction.bind(null, context.organization.id, context.project.id, path)} className="mt-5 grid gap-4">
        <Field label="Name" name="name" defaultValue={context.project.name}/><Field label="Timezone" name="timezone"><select name="timezone" defaultValue={context.project.timezone} className="h-11 rounded-lg border border-foreground/15 bg-background px-3">{zones.map((zone) => <option key={zone}>{zone}</option>)}</select></Field>
        <Field label="Base currency" name="baseCurrency"><select name="baseCurrency" defaultValue={context.project.baseCurrency} className="h-11 rounded-lg border border-foreground/15 bg-background px-3">{["EUR","USD","GBP","HUF"].map((item) => <option key={item}>{item}</option>)}</select></Field><SubmitButton>Save project</SubmitButton>
      </form></section>
      <section className={card}><h2 className="text-xl font-medium">Organization</h2><form action={updateOrganizationAction.bind(null, context.organization.id, path)} className="mt-5 grid gap-4">
        <Field label="Name" name="name" defaultValue={context.organization.name}/><Field label="Timezone" name="timezone"><select name="timezone" defaultValue={context.organization.timezone} className="h-11 rounded-lg border border-foreground/15 bg-background px-3">{zones.map((zone) => <option key={zone}>{zone}</option>)}</select></Field><SubmitButton>Save organization</SubmitButton>
      </form></section>
      <section className={card}><h2 className="text-xl font-medium">Create another project</h2><form action={createProjectAction.bind(null, context.organization.id, context.organization.slug)} className="mt-5 grid gap-4">
        <Field label="Project name" name="name"/><input type="hidden" name="timezone" value={context.project.timezone}/><input type="hidden" name="baseCurrency" value={context.project.baseCurrency}/><SubmitButton>Create project</SubmitButton>
      </form></section>
      <section className={card}><h2 className="text-xl font-medium">Account</h2><dl className="mt-5 grid gap-3 text-sm"><div><dt className="text-muted-foreground">Name</dt><dd>{user.name}</dd></div><div><dt className="text-muted-foreground">Email</dt><dd>{user.email}</dd></div><div><dt className="text-muted-foreground">Role</dt><dd>{context.role}</dd></div></dl></section>
    </div>
  </main>;
}

