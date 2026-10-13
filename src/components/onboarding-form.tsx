"use client";

import { Check } from "lucide-react";
import { useActionState, useState } from "react";

import { FUNNEL_TEMPLATES } from "@/lib/funnel-templates";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/primitives";
import { createWorkspace } from "@/server/actions/onboarding";

/**
 * Workspace setup.
 *
 * Presented as one form rather than a multi-step wizard: every field is
 * something the user already knows, and eight separate screens for eight
 * fields is ceremony, not guidance. The steps the specification describes —
 * install tracking, send an event, connect revenue — happen on the
 * Integrations page afterwards, where the real keys exist.
 */
export function OnboardingForm() {
  const [state, action, pending] = useActionState(createWorkspace, null);
  const [template, setTemplate] = useState("high_ticket");

  const detectedTimezone =
    typeof Intl !== "undefined"
      ? (Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC")
      : "UTC";

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="mb-8">
        <h1 className="text-lg font-semibold tracking-tight">
          Set up your workspace
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Two names, a timezone and a starting funnel. You can change all of
          them later.
        </p>
      </div>

      <form action={action} className="space-y-8">
        <section className="space-y-4">
          <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Organization
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="organizationName">Name</Label>
              <Input
                id="organizationName"
                name="organizationName"
                required
                minLength={2}
                placeholder="Northlight AI"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="timezone">Timezone</Label>
              <Input
                id="timezone"
                name="timezone"
                required
                defaultValue={detectedTimezone}
              />
              <p className="text-2xs text-subtle-foreground">
                Every daily figure is bucketed in this timezone, so everyone on
                your team sees the same numbers.
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Project
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="projectName">Name</Label>
              <Input
                id="projectName"
                name="projectName"
                required
                minLength={2}
                placeholder="Main website"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="baseCurrency">Base currency</Label>
              <Input
                id="baseCurrency"
                name="baseCurrency"
                required
                maxLength={3}
                minLength={3}
                defaultValue="EUR"
                className="uppercase"
              />
              <p className="text-2xs text-subtle-foreground">
                Events in another currency are flagged, never silently
                converted.
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Starting funnel
          </h2>

          <input type="hidden" name="templateKey" value={template} />

          <div className="grid gap-2 sm:grid-cols-2">
            {FUNNEL_TEMPLATES.map((option) => {
              const selected = template === option.key;

              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setTemplate(option.key)}
                  aria-pressed={selected}
                  className={cn(
                    "rounded-[var(--radius-card)] border px-3.5 py-3 text-left transition-colors",
                    selected
                      ? "border-accent bg-accent-subtle"
                      : "border-border bg-surface hover:border-border-strong",
                  )}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{option.name}</span>
                    {selected ? (
                      <Check className="size-4 text-accent" aria-hidden />
                    ) : null}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {option.description}
                  </span>
                  <span className="mt-1.5 block text-2xs text-subtle-foreground">
                    {option.steps.length}{" "}
                    {option.steps.length === 1 ? "step" : "steps"} ·{" "}
                    {option.conversionWindowDays} day window
                  </span>
                </button>
              );
            })}
          </div>

          <p className="text-2xs leading-relaxed text-subtle-foreground">
            Templates ship without conversion targets. A target you did not
            choose would immediately produce a fictional revenue gap, so you set
            them once you have a baseline.
          </p>
        </section>

        {state && "error" in state ? (
          <p role="alert" className="text-xs text-negative">
            {state.error}
          </p>
        ) : null}

        <Button type="submit" disabled={pending}>
          {pending ? "Creating workspace…" : "Create workspace"}
        </Button>
      </form>
    </div>
  );
}
