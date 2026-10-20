"use client";

import {
  Activity,
  BarChart3,
  Building2,
  GitBranch,
  Layers,
  LineChart,
  Route,
  Settings,
  Sparkles,
  Target,
  Users,
  Menu,
  X,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Brand } from "@/components/brand";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: React.ElementType };

const NAV_GROUPS: Array<{ label: string | null; items: NavItem[] }> = [
  {
    label: null,
    items: [{ href: "/overview", label: "Áttekintés", icon: BarChart3 }],
  },
  {
    label: "Elemzés",
    items: [
      { href: "/funnels", label: "Tölcsérek", icon: GitBranch },
      { href: "/journeys", label: "Ügyfélutak", icon: Route },
      { href: "/opportunities", label: "Lehetőségek", icon: Target },
    ],
  },
  {
    label: "Mérés",
    items: [
      { href: "/attribution", label: "Attribúció", icon: Layers },
      { href: "/cohorts", label: "Kohorszok és ügyfélérték", icon: Users },
      { href: "/revenue", label: "Bevétel", icon: LineChart },
    ],
  },
  // Experiments is modelled in the schema but has no implementation yet, so it
  // is deliberately absent rather than linking to a page that pretends to work.
  {
    label: "Működés",
    items: [
      { href: "/tracking-health", label: "Mérés állapota", icon: Activity },
      { href: "/ai", label: "AI-elemző", icon: Sparkles },
    ],
  },
  {
    label: null,
    items: [
      { href: "/integrations", label: "Integrációk", icon: Building2 },
      { href: "/settings", label: "Beállítások", icon: Settings },
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
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-4 focus:py-3 focus:text-accent-foreground"
      >
        Ugrás a tartalomra
      </a>
      <aside className="hidden sticky top-0 h-svh w-64 shrink-0 flex-col border-r border-border bg-background md:flex">
        <div className="flex flex-col gap-5 border-b border-border px-5 py-7">
          <Brand />
          <span className="truncate text-xs text-muted-foreground">
            {organizationName}
            {projects[0] ? ` · ${projects[0].name}` : ""}
          </span>
        </div>

        <nav
          aria-label="Fő navigáció"
          className="flex-1 overflow-y-auto px-3 py-5"
        >
          {NAV_GROUPS.map((group, index) => (
            <div key={group.label ?? `group-${index}`} className="mb-6">
              {group.label ? (
                <p className="px-3 pb-2 font-mono text-[10px] font-medium tracking-[0.15em] text-subtle-foreground uppercase">
                  {group.label}
                </p>
              ) : null}
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const active =
                    pathname === item.href ||
                    pathname.startsWith(`${item.href}/`);
                  const Icon = item.icon;

                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex items-center gap-2.5 rounded-[var(--radius-control)] px-3 py-2.5 text-sm transition-colors",
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
          <Link href="/signout" className="text-xs text-accent hover:underline">
            Kijelentkezés
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-5 md:hidden">
          <Brand />
          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-expanded={mobileOpen}
            aria-controls="mobile-navigation"
            aria-label={mobileOpen ? "Menü bezárása" : "Menü megnyitása"}
            className="flex size-11 items-center justify-center rounded-[var(--radius-control)] border border-border text-foreground"
          >
            {mobileOpen ? (
              <X className="size-5" aria-hidden />
            ) : (
              <Menu className="size-5" aria-hidden />
            )}
          </button>
        </div>
        <nav
          id="mobile-navigation"
          aria-label="Mobil navigáció"
          className={cn(
            "flex flex-wrap gap-1 border-b border-border bg-surface px-3 py-3 md:hidden",
            !mobileOpen && "hidden",
          )}
        >
          {NAV_GROUPS.flatMap((group) => group.items)
            .concat([{ href: "/signout", label: "Kijelentkezés", icon: Users }])
            .map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                aria-current={pathname === item.href ? "page" : undefined}
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

        <main id="main-content" className="min-w-0 flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}
