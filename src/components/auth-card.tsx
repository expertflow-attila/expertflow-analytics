import type { ReactNode } from "react";
import Link from "next/link";

export function AuthCard({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer?: ReactNode }) {
  return <main className="min-h-screen grid place-items-center px-6 py-12 bg-background text-foreground">
    <section className="w-full max-w-md rounded-2xl border border-foreground/10 bg-card p-8 shadow-2xl shadow-black/10">
      <Link href="/" className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">Funnel Intelligence OS</Link>
      <h1 className="mt-8 text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{subtitle}</p>
      <div className="mt-8">{children}</div>
      {footer && <div className="mt-6 text-sm text-muted-foreground">{footer}</div>}
    </section>
  </main>;
}

export function Field({ label, name, type = "text", defaultValue, required = true, children }: { label: string; name: string; type?: string; defaultValue?: string; required?: boolean; children?: ReactNode }) {
  return <label className="grid gap-2 text-sm font-medium"><span>{label}</span>
    {children ?? <input className="h-11 rounded-lg border border-foreground/15 bg-background px-3 outline-none focus:ring-2 focus:ring-accent" name={name} type={type} defaultValue={defaultValue} required={required} />}
  </label>;
}

export function SubmitButton({ children }: { children: ReactNode }) {
  return <button className="h-11 w-full rounded-lg bg-primary px-4 font-semibold text-primary-foreground transition-opacity hover:opacity-90" type="submit">{children}</button>;
}

