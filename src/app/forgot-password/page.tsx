"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/primitives";
import { requestPasswordReset } from "@/server/actions/password";

export default function ForgotPasswordPage() {
  const [state, action, pending] = useActionState(requestPasswordReset, null);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <h1 className="text-lg font-semibold tracking-tight">
            Reset your password
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Password reset email delivery is not configured. Contact your
            workspace administrator.
          </p>
        </div>

        <form action={action} className="space-y-4">
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

          {state && "error" in state ? (
            <p role="alert" className="text-xs text-negative">
              {state.error}
            </p>
          ) : null}

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Sending…" : "Send reset link"}
          </Button>
        </form>

        <p className="mt-6 text-xs text-muted-foreground">
          <Link href="/login" className="text-accent hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
