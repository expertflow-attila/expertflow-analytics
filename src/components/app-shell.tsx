import type { ReactNode } from "react";
import Link from "next/link";
import { BarChart3, Bot, CircleDollarSign, FlaskConical, HeartPulse, Route, Settings, Sparkles, UsersRound } from "lucide-react";
import { logoutAction } from "@/app/(auth)/actions";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";

const future = [["Funnels", BarChart3], ["Journeys", Route], ["Opportunities", Sparkles], ["Attribution", UsersRound], ["Cohorts & LTV", HeartPulse], ["Revenue", CircleDollarSign], ["Experiments", FlaskConical], ["AI Analyst", Bot]] as const;
export function AppShell({ children, organization, project, role, organizationOptions, projectOptions }: { children: ReactNode; organization: { name: string; slug: string }; project: { name: string; slug: string }; role: string; organizationOptions: { label: string; url: string; value: string }[]; projectOptions: { label: string; url: string; value: string }[] }) {
  const base = `/app/${organization.slug}/${project.slug}`;
  return <div className="min-h-screen bg-background text-foreground lg:grid lg:grid-cols-[260px_1fr]"><aside className="border-r border-foreground/10 bg-card p-5">
    <Link href={base + "/overview"} className="font-semibold tracking-tight">Funnel Intelligence</Link>
    <div className="mt-8 grid gap-3 rounded-xl border border-foreground/10 p-3"><WorkspaceSwitcher label="Organization" value={organization.slug} options={organizationOptions}/><WorkspaceSwitcher label="Project" value={project.slug} options={projectOptions}/><p className="font-mono text-[10px] text-muted-foreground">{role}</p></div>
    <nav className="mt-7 grid gap-1 text-sm"><Link className="rounded-lg bg-foreground/8 px-3 py-2.5" href={base + "/overview"}>Overview</Link>
      {future.map(([label, Icon]) => <span key={label} aria-disabled="true" title="Coming in a later phase" className="flex cursor-not-allowed items-center gap-2 rounded-lg px-3 py-2.5 text-muted-foreground/55"><Icon size={15}/>{label}<span className="ml-auto text-[9px] uppercase">Soon</span></span>)}
      <Link className="mt-3 flex items-center gap-2 rounded-lg px-3 py-2.5" href={base + "/settings"}><Settings size={15}/>Settings</Link></nav>
    <form action={logoutAction} className="mt-8"><button className="text-sm text-muted-foreground hover:text-foreground">Sign out</button></form>
  </aside><div className="min-w-0">{children}</div></div>;
}
