"use client";
import { displayLabel } from "@/lib/labels";

import { useState } from "react";
import { ConfigForm } from "@/components/config-form";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/primitives";
import { saveFunnel } from "@/server/actions/funnels";

type Step = {
  id?: string;
  name: string;
  eventName: string;
  target: string | number;
};
export type FunnelDraft = {
  id?: string;
  name: string;
  mode: "STRICT" | "ORDERED" | "FLEXIBLE";
  windowDays: number;
  steps: Step[];
};
export function FunnelEditor({
  projectId,
  initial,
}: {
  projectId: string;
  initial?: FunnelDraft;
}) {
  const [draft, setDraft] = useState<FunnelDraft>(
    initial ?? {
      name: "Új tölcsér",
      mode: "ORDERED",
      windowDays: 30,
      steps: [{ name: "Érkezőoldal", eventName: "page_view", target: "" }],
    },
  );
  function update(index: number, patch: Partial<Step>) {
    setDraft((d) => ({
      ...d,
      steps: d.steps.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    }));
  }
  function move(index: number, delta: number) {
    setDraft((d) => {
      const steps = [...d.steps];
      [steps[index], steps[index + delta]] = [
        steps[index + delta],
        steps[index],
      ];
      return { ...d, steps };
    });
  }
  return (
    <details className="min-w-0 rounded-[var(--radius-card)] border bg-surface p-4">
      <summary className="cursor-pointer text-sm font-medium">
        {initial ? "Tölcsér szerkesztése" : "Tölcsér létrehozása"}
      </summary>
      <div className="pt-4">
        <ConfigForm action={saveFunnel} submitLabel="Tölcsér mentése">
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="funnel" value={JSON.stringify(draft)} />
          <label className="block text-xs">
            Tölcsér neve
            <Input
              aria-label="Tölcsér neve"
              required
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </label>
          <label className="block text-xs">
            Egyezés módja
            <select
              aria-label="Egyezés módja"
              className="mt-1 block w-full rounded-[var(--radius-control)] border bg-background p-2"
              value={draft.mode}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  mode: e.target.value as FunnelDraft["mode"],
                })
              }
            >
              {["STRICT", "ORDERED", "FLEXIBLE"].map((m) => (
                <option key={m} value={m}>
                  {displayLabel(m)}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs">
            Konverziós időablak (nap)
            <Input
              aria-label="Konverziós időablak (nap)"
              type="number"
              min={1}
              max={365}
              required
              value={draft.windowDays}
              onChange={(e) =>
                setDraft({ ...draft, windowDays: Number(e.target.value) })
              }
            />
          </label>
          <p className="text-xs text-muted-foreground">
            A lépések az alábbi sorrendben kapcsolódnak. A cél a következő
            lépésre továbblépők százalékos aránya; ismeretlen cél esetén hagyd
            üresen. A mentés a vásznat is frissíti.
          </p>
          <ol className="space-y-3">
            {draft.steps.map((step, i) => (
              <li
                key={step.id ?? `new-${i}`}
                className="rounded-lg border p-3"
                data-testid="editable-step"
              >
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">Lépés {i + 1}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                    aria-label={`${i + 1}. lépés felfelé`}
                  >
                    ↑
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={i === draft.steps.length - 1}
                    onClick={() => move(i, 1)}
                    aria-label={`${i + 1}. lépés lefelé`}
                  >
                    ↓
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={draft.steps.length === 1}
                    onClick={() =>
                      setDraft({
                        ...draft,
                        steps: draft.steps.filter((_, n) => n !== i),
                      })
                    }
                  >
                    Lépés törlése: {i + 1}
                  </Button>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <Label htmlFor={`step-name-${i}`}>Név</Label>
                    <Input
                      id={`step-name-${i}`}
                      value={step.name}
                      required
                      onChange={(e) => update(i, { name: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor={`step-event-${i}`}>Esemény</Label>
                    <Input
                      id={`step-event-${i}`}
                      value={step.eventName}
                      required
                      pattern="[a-z0-9_]+"
                      onChange={(e) => update(i, { eventName: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor={`step-target-${i}`}>Cél (%)</Label>
                    <Input
                      id={`step-target-${i}`}
                      type="number"
                      min={0}
                      max={100}
                      step="0.01"
                      value={step.target}
                      onChange={(e) => update(i, { target: e.target.value })}
                    />
                  </div>
                </div>
              </li>
            ))}
          </ol>
          <Button
            type="button"
            variant="secondary"
            disabled={draft.steps.length >= 100}
            onClick={() =>
              setDraft({
                ...draft,
                steps: [
                  ...draft.steps,
                  { name: "Új lépés", eventName: "lead_created", target: "" },
                ],
              })
            }
          >
            Lépés hozzáadása
          </Button>
        </ConfigForm>
      </div>
    </details>
  );
}
