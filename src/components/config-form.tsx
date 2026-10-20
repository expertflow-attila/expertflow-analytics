"use client";

import { useActionState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import type { ConfigResult } from "@/server/actions/configuration";

export function ConfigForm({
  action,
  children,
  submitLabel = "Save",
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
        {pending ? "Saving…" : submitLabel}
      </Button>
      {state.error ? (
        <p role="alert" className="text-sm text-negative">
          {state.error}
        </p>
      ) : state.ok ? (
        <p role="status" className="text-sm text-positive">
          Saved.
        </p>
      ) : null}
      {state.secret ? (
        <div className="rounded-md border border-warning p-3">
          <p className="text-sm">
            Copy this key now. It will not be shown again after leaving this
            page.
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
