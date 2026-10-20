"use client";

import Link from "next/link";
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
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <h1 className="text-lg font-semibold tracking-tight">Invalid link</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This password reset link is missing or invalid.
          </p>
          <p className="mt-6 text-xs">
            <Link
              href="/forgot-password"
              className="text-accent hover:underline"
            >
              Request a new link
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <h1 className="text-lg font-semibold tracking-tight">
            Set a new password
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose a new password for your account.
          </p>
        </div>

        <form action={action} className="space-y-4">
          <input type="hidden" name="token" value={token} />

          <div className="space-y-1.5">
            <Label htmlFor="password">New password</Label>
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
            {pending ? "Updating…" : "Update password"}
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

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<p role="status">Loading password reset…</p>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
