import type { ReactNode } from "react";
import { Brand } from "@/components/brand";

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-8 px-4 py-10 sm:py-16">
      <Brand href="/login" />
      <div className="auth-panel w-full max-w-md rounded-[var(--radius-card)] border border-border bg-surface p-6 sm:p-9">
        {children}
      </div>
      <p className="font-mono text-[10px] tracking-[0.14em] text-subtle-foreground uppercase">
        Adatokból tisztán látható döntések.
      </p>
    </main>
  );
}
