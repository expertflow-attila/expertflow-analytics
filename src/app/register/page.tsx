"use client";

import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/primitives";
import { registerUser } from "@/server/actions/onboarding";

export default function RegisterPage() {
  const [state, action, pending] = useActionState(registerUser, null);

  return (
    <AuthShell>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">
          Hozd létre a fiókodat
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A következő lépésben beállíthatod a munkaterületedet.
        </p>
      </div>

      <form action={action} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">Név</Label>
          <Input
            id="name"
            name="name"
            autoComplete="name"
            placeholder="Teljes neved"
          />
        </div>

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

        <div className="space-y-1.5">
          <Label htmlFor="password">Jelszó</Label>
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
          {pending ? "Fiók létrehozása…" : "Fiók létrehozása"}
        </Button>
      </form>

      <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
        Már van fiókod?{" "}
        <Link href="/login" className="text-accent hover:underline">
          Bejelentkezés
        </Link>
      </p>
    </AuthShell>
  );
}
