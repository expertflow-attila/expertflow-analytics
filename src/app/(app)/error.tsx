"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto my-12 max-w-lg rounded-[var(--radius-card)] border border-border bg-surface p-6">
      <h1 className="text-2xl font-semibold">Az oldal nem tölthető be</h1>
      <p className="mt-3 mb-6 text-sm leading-relaxed text-muted-foreground">
        Átmeneti hiba történt az adatok lekérésekor. Próbáld újra néhány
        pillanat múlva.
      </p>
      <Button onClick={reset}>Újrapróbálás</Button>
    </div>
  );
}
