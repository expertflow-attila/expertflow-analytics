import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/primitives";
import { auth, signIn } from "@/server/auth";

export const metadata = { title: "Bejelentkezés" };

async function signInAction(formData: FormData) {
  "use server";

  try {
    await signIn("credentials", {
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      redirectTo: "/overview",
    });
  } catch (error) {
    // next-auth signals a successful redirect by throwing; re-throw so Next
    // can handle it, and surface anything else as a failed sign-in.
    if (error instanceof Error && error.message.includes("NEXT_REDIRECT")) {
      throw error;
    }
    redirect("/login?error=1");
  }
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    registered?: string;
    reset?: string;
  }>;
}) {
  const session = await auth();
  if (session?.user) redirect("/overview");

  const { error, registered, reset } = await searchParams;

  return (
    <AuthShell>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Üdv újra!</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Jelentkezz be a munkaterületedre.
        </p>
      </div>

      {registered ? (
        <p className="mb-4 rounded-md bg-positive-subtle px-3 py-2 text-xs text-positive">
          A fiókod elkészült. Jelentkezz be a munkaterület beállításához.
        </p>
      ) : null}

      {reset ? (
        <p className="mb-4 rounded-md bg-positive-subtle px-3 py-2 text-xs text-positive">
          A jelszavad megváltozott. Most már bejelentkezhetsz.
        </p>
      ) : null}

      <form action={signInAction} className="space-y-4">
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
            autoComplete="current-password"
            required
            minLength={8}
          />
        </div>

        {error ? (
          <p role="alert" className="text-xs text-negative">
            Az e-mail-cím vagy a jelszó nem megfelelő.
          </p>
        ) : null}

        <Button type="submit" className="w-full">
          Bejelentkezés
        </Button>
      </form>

      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
        <Link href="/forgot-password" className="text-accent hover:underline">
          Elfelejtetted a jelszavad?
        </Link>
      </p>

      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        <Link href="/register" className="text-accent hover:underline">
          Fiók létrehozása
        </Link>
      </p>
    </AuthShell>
  );
}
