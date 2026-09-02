import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { projects } from "@/server/db/schema";
import { listUserOrganizations } from "@/server/tenancy";
import { eq } from "drizzle-orm";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const organizations = await listUserOrganizations(session.user.id);
  if (organizations.length === 0) redirect("/onboarding");

  const projectRows = await db
    .select({
      id: projects.id,
      name: projects.name,
      organizationId: projects.organizationId,
    })
    .from(projects)
    .where(eq(projects.organizationId, organizations[0].id));

  if (projectRows.length === 0) redirect("/onboarding");

  return (
    <AppShell
      organizationName={organizations[0].name}
      projects={projectRows}
      userEmail={session.user.email ?? ""}
    >
      {children}
    </AppShell>
  );
}
