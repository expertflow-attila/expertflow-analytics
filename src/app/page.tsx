import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getFirstWorkspaceForUser } from "@/server/services/project-service";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const workspace = await getFirstWorkspaceForUser(session.user.id);
  if (!workspace) redirect("/onboarding");
  redirect(`/app/${workspace.organizationSlug}/${workspace.projectSlug}/overview`);
}
