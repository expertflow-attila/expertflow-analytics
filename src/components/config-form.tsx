"use client";

import { useActionState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import type { ConfigResult } from "@/server/actions/configuration";

export function ConfigForm({
  action,
  children,
  submitLabel = "Mentés",
  confirmation,
}: {
  action: (state: ConfigResult, data: FormData) => Promise<ConfigResult>;
  children: ReactNode;
  submitLabel?: string;
  confirmation?: string;
}) {
  const [state, submit, pending] = useActionState(action, {});
  return (
    <form
      action={submit}
      className="space-y-3"
      onSubmit={(event) => {
        if (confirmation && !window.confirm(confirmation))
          event.preventDefault();
      }}
    >
      {children}
      <Button type="submit" disabled={pending}>
        {pending ? "Mentés…" : submitLabel}
      </Button>
      {state.error ? (
        <p role="alert" className="text-sm text-negative">
          {state.error}
        </p>
      ) : state.ok ? (
        <p role="status" className="text-sm text-positive">
          Mentve.
        </p>
      ) : null}
      {state.secret ? (
        <div className="rounded-md border border-warning p-3">
          <p className="text-sm">
            Másold ki most a kulcsot. Az oldal elhagyása után nem jelenik meg
            újra.
          </p>
          <code
            className="mt-2 block break-all select-all"
            data-testid="new-api-key"
          >
            {state.secret}
          </code>
        </div>
      ) : null}
    </form>
  );
}
