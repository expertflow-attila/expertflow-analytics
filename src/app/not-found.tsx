import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
export default function NotFound() {
  return (
    <AuthShell>
      <p className="mb-3 font-mono text-xs text-accent">404</p>
      <h1 className="text-2xl font-semibold">Ez az oldal nem található</h1>
      <p className="mt-3 mb-6 text-sm leading-relaxed text-muted-foreground">
        Ellenőrizd a hivatkozást, vagy térj vissza az áttekintéshez.
      </p>
      <Button asChild>
        <Link href="/overview">Vissza az áttekintéshez</Link>
      </Button>
    </AuthShell>
  );
}
