"use client";

import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { Suspense, useActionState } from "react";
import { useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/primitives";
import { resetPassword } from "@/server/actions/password";

function ResetPasswordForm() {
  const [state, action, pending] = useActionState(resetPassword, null);
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  if (!token) {
    return (
      <AuthShell>
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            Érvénytelen hivatkozás
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            A jelszó-visszaállítási hivatkozás hiányzik vagy érvénytelen.
          </p>
          <p className="mt-6 text-xs">
            <Link
              href="/forgot-password"
              className="text-accent hover:underline"
            >
              Új hivatkozás kérése
            </Link>
          </p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">
          Új jelszó beállítása
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Válassz új jelszót a fiókodhoz.
        </p>
      </div>

      <form action={action} className="space-y-4">
        <input type="hidden" name="token" value={token} />

        <div className="space-y-1.5">
          <Label htmlFor="password">Új jelszó</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
          />
          <p className="text-2xs text-subtle-foreground">
            Legalább 8 karakter.
          </p>
        </div>

        {state && "error" in state ? (
          <p role="alert" className="text-xs text-negative">
            {state.error}
          </p>
        ) : null}

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Mentés…" : "Jelszó mentése"}
        </Button>
      </form>

      <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
        <Link href="/login" className="text-accent hover:underline">
          Vissza a bejelentkezéshez
        </Link>
      </p>
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<p role="status">Jelszó-visszaállítás betöltése…</p>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
