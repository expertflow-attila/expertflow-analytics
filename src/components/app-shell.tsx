"use client";

import {
  Activity,
  BarChart3,
  Beaker,
  Building2,
  GitBranch,
  Layers,
  LineChart,
  Route,
  Settings,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: React.ElementType };

const NAV_GROUPS: Array<{ label: string | null; items: NavItem[] }> = [
  {
    label: null,
    items: [{ href: "/overview", label: "Overview", icon: BarChart3 }],
  },
  {
    label: "Analyse",
    items: [
      { href: "/funnels", label: "Funnels", icon: GitBranch },
      { href: "/journeys", label: "Journey", icon: Route },
      { href: "/opportunities", label: "Opportunities", icon: Target },
    ],
  },
  {
    label: "Measure",
    items: [
      { href: "/attribution", label: "Attribution", icon: Layers },
      { href: "/cohorts", label: "Cohorts & LTV", icon: Users },
      { href: "/revenue", label: "Revenue", icon: LineChart },
    ],
  },
  {
    label: "Operate",
    items: [
      { href: "/experiments", label: "Experiments", icon: Beaker },
      { href: "/tracking-health", label: "Tracking Health", icon: Activity },
      { href: "/ai", label: "AI Analyst", icon: Sparkles },
    ],
  },
  {
    label: null,
    items: [
      { href: "/integrations", label: "Integrations", icon: Building2 },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

export function AppShell({
  organizationName,
  projects,
  userEmail,
  children,
}: {
  organizationName: string;
  projects: Array<{ id: string; name: string }>;
  userEmail: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-surface md:flex">
        <div className="flex flex-col gap-0.5 border-b border-border px-4 py-4">
          <span className="text-sm font-semibold tracking-tight">
            Funnel Intelligence
          </span>
          <span className="truncate text-xs text-muted-foreground">
            {organizationName}
            {projects[0] ? ` · ${projects[0].name}` : ""}
          </span>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3">
          {NAV_GROUPS.map((group, index) => (
            <div key={group.label ?? `group-${index}`} className="mb-3">
              {group.label ? (
                <p className="px-2 pb-1.5 text-2xs font-medium tracking-wide text-subtle-foreground uppercase">
                  {group.label}
                </p>
              ) : null}
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const active =
                    pathname === item.href || pathname.startsWith(`${item.href}/`);
                  const Icon = item.icon;

                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors",
                          active
                            ? "bg-accent-subtle font-medium text-accent"
                            : "text-muted-foreground hover:bg-surface-muted hover:text-foreground",
                        )}
                      >
                        <Icon className="size-4 shrink-0" aria-hidden />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-border px-4 py-3">
          <p className="truncate text-xs text-muted-foreground">{userEmail}</p>
          <Link
            href="/api/auth/signout"
            className="text-xs text-accent hover:underline"
          >
            Sign out
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile navigation: the analytics surfaces that make sense on a phone. */}
        <nav className="flex gap-1 overflow-x-auto border-b border-border bg-surface px-3 py-2 md:hidden">
          {[
            { href: "/overview", label: "Overview" },
            { href: "/opportunities", label: "Opportunities" },
            { href: "/funnels", label: "Funnels" },
            { href: "/tracking-health", label: "Health" },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs whitespace-nowrap",
                pathname.startsWith(item.href)
                  ? "bg-accent-subtle font-medium text-accent"
                  : "text-muted-foreground",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
