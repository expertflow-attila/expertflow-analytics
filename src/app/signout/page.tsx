import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { signOut } from "@/server/auth";

export const metadata = { title: "Kijelentkezés" };
export default function SignOutPage() {
  return (
    <AuthShell>
      <h1 className="text-2xl font-semibold">Kijelentkezés</h1>
      <p className="mt-3 mb-6 text-sm leading-relaxed text-muted-foreground">
        Biztosan kijelentkezel a munkaterületről?
      </p>
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/login" });
        }}
      >
        <Button type="submit" className="w-full">
          Kijelentkezés
        </Button>
      </form>
      <Link
        href="/overview"
        className="mt-5 block text-center text-sm text-accent"
      >
        Vissza az áttekintéshez
      </Link>
    </AuthShell>
  );
}
