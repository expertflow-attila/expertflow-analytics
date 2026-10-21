"use client";

import Link from "next/link";
import { Suspense, useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/primitives";
import {
  confirmEmail,
  resendVerification,
} from "@/server/actions/email-verification";

function VerificationForm() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const notice = params.get("notice");
  const [confirmation, confirm, pendingConfirm] = useActionState(
    confirmEmail,
    null,
  );
  const [resend, resendAction, pendingResend] = useActionState(
    resendVerification,
    null,
  );
  return (
    <AuthShell>
      <h1 className="text-2xl font-semibold tracking-tight">
        E-mail-cím megerősítése
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        A belépéshez igazold, hogy az e-mail-cím hozzád tartozik.
      </p>
      {notice === "sent" ? (
        <p role="status" className="mt-4 text-sm text-positive">
          Elküldtük a megerősítő levelet. Nézd meg a beérkező és a spam mappát.
          A hivatkozás 24 óráig érvényes.
        </p>
      ) : null}
      {notice === "delivery-failed" ? (
        <p role="alert" className="mt-4 text-sm text-negative">
          A fiókod elkészült, de a megerősítő levelet nem sikerült elküldeni.
          Kérj új levelet az alábbi űrlapon.
        </p>
      ) : null}
      {notice === "required" ? (
        <p role="alert" className="mt-4 text-sm text-warning">
          A fiókod e-mail-címe még nincs megerősítve. Nyisd meg a megerősítő
          levelet, vagy kérj újat.
        </p>
      ) : null}
      {token && !(confirmation && "error" in confirmation) ? (
        <form action={confirm} className="mt-6 space-y-4">
          <input type="hidden" name="token" value={token} />
          <p className="text-sm text-muted-foreground">
            A gombbal megerősítheted az e-mail-címedet. Ezután a jelszavaddal
            jelentkezhetsz be.
          </p>
          <Button type="submit" className="w-full" disabled={pendingConfirm}>
            {pendingConfirm ? "Megerősítés…" : "E-mail-cím megerősítése"}
          </Button>
        </form>
      ) : null}
      {confirmation && "error" in confirmation ? (
        <p role="alert" className="mt-4 text-sm text-negative">
          {confirmation.error}
        </p>
      ) : null}
      <form action={resendAction} className="mt-6 space-y-4">
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
        {resend && "error" in resend ? (
          <p role="alert" className="text-sm text-negative">
            {resend.error}
          </p>
        ) : null}
        {resend && "ok" in resend ? (
          <p role="status" className="text-sm text-positive">
            Ha ehhez a címhez még nem megerősített fiók tartozik, elküldtük a
            levelet. Nézd meg a spam mappát is. Új levelet egy perc múlva
            kérhetsz.
          </p>
        ) : null}
        <Button
          type="submit"
          variant="secondary"
          className="w-full"
          disabled={pendingResend}
        >
          {pendingResend ? "Küldés…" : "Megerősítő levél kérése"}
        </Button>
      </form>
      <Link
        href="/login"
        className="mt-6 block text-sm text-accent hover:underline"
      >
        Vissza a bejelentkezéshez
      </Link>
    </AuthShell>
  );
}
export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<p role="status">Megerősítés betöltése…</p>}>
      <VerificationForm />
    </Suspense>
  );
}
