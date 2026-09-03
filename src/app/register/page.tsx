"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/primitives";
import { registerUser } from "@/server/actions/onboarding";

export default function RegisterPage() {
  const [state, action, pending] = useActionState(registerUser, null);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <h1 className="text-lg font-semibold tracking-tight">
            Create your account
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            You will set up your workspace next.
          </p>
        </div>

        <form action={action} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" autoComplete="name" placeholder="Your name" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@company.com"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
            />
            <p className="text-2xs text-subtle-foreground">
              At least 8 characters.
            </p>
          </div>

          {state && "error" in state ? (
            <p role="alert" className="text-xs text-negative">
              {state.error}
            </p>
          ) : null}

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Creating account…" : "Create account"}
          </Button>
        </form>

        <p className="mt-6 text-xs text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="text-accent hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
