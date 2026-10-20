"use client";

import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/primitives";
import { requestPasswordReset } from "@/server/actions/password";

export default function ForgotPasswordPage() {
  const [state, action, pending] = useActionState(requestPasswordReset, null);

  return (
    <AuthShell>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">
          Jelszó visszaállítása
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A jelszó-visszaállító e-mailek küldése még nincs beállítva. Kérj
          segítséget a munkaterület rendszergazdájától.
        </p>
      </div>

      <form action={action} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">E-mail-cím</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="nev@ceg.hu"
          />
        </div>

        {state && "error" in state ? (
          <p role="alert" className="text-xs text-negative">
            {state.error}
          </p>
        ) : null}

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Küldés…" : "Visszaállítási link kérése"}
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
