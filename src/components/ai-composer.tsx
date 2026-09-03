"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { askAnalyst } from "@/server/actions/ai";

const SUGGESTIONS = [
  "Where is my biggest revenue leak?",
  "Which channel brings the highest lifetime value customers?",
  "What changed in the last two weeks?",
  "How reliable is my tracking right now?",
];

export function AiComposer({ conversationId }: { conversationId?: string }) {
  const [state, action, pending] = useActionState(askAnalyst, null);

  return (
    <div className="space-y-3">
      <form action={action} className="space-y-2">
        {conversationId ? (
          <input type="hidden" name="conversationId" value={conversationId} />
        ) : null}

        <textarea
          name="question"
          rows={3}
          required
          minLength={3}
          disabled={pending}
          placeholder="Ask about your funnel, channels, customers or revenue."
          className="w-full rounded-md border border-border bg-surface px-3 py-2.5 text-sm placeholder:text-subtle-foreground disabled:opacity-60"
        />

        <div className="flex items-center justify-between gap-3">
          <p className="text-2xs text-subtle-foreground">
            Answers are written only from analytics tool results. Figures that
            cannot be computed are reported as unavailable.
          </p>
          <Button type="submit" disabled={pending}>
            {pending ? "Analysing…" : "Ask"}
          </Button>
        </div>

        {state && "error" in state ? (
          <p role="alert" className="text-xs text-negative">
            {state.error}
          </p>
        ) : null}
      </form>

      <div className="flex flex-wrap gap-1.5">
        {SUGGESTIONS.map((suggestion) => (
          <form key={suggestion} action={action}>
            {conversationId ? (
              <input type="hidden" name="conversationId" value={conversationId} />
            ) : null}
            <input type="hidden" name="question" value={suggestion} />
            <button
              type="submit"
              disabled={pending}
              className="rounded-full border border-border px-2.5 py-1 text-2xs text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground disabled:opacity-50"
            >
              {suggestion}
            </button>
          </form>
        ))}
      </div>
    </div>
  );
}
