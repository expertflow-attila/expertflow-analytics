"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { askAnalyst } from "@/server/actions/ai";

const SUGGESTIONS = [
  "Hol veszítjük a legtöbb bevételt?",
  "Melyik csatorna hozza a legnagyobb értékű ügyfeleket?",
  "Mi változott az elmúlt két hétben?",
  "Mennyire megbízható most a mérésünk?",
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
          placeholder="Kérdezz a tölcsérről, a csatornákról, az ügyfelekről vagy a bevételről."
          className="w-full rounded-md border border-border bg-surface px-3 py-2.5 text-sm placeholder:text-subtle-foreground disabled:opacity-60"
        />

        <div className="flex items-center justify-between gap-3">
          <p className="text-2xs text-subtle-foreground">
            A válaszok kizárólag az elemzések eredményeire támaszkodnak. A nem
            számítható értékeket nem elérhetőként jelezzük.
          </p>
          <Button type="submit" disabled={pending}>
            {pending ? "Elemzés…" : "Kérdezés"}
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
              <input
                type="hidden"
                name="conversationId"
                value={conversationId}
              />
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
