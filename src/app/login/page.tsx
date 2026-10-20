import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/primitives";
import { auth, signIn } from "@/server/auth";

export const metadata = { title: "Sign in" };

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
  searchParams: Promise<{ error?: string; registered?: string; reset?: string }>;
}) {
  const session = await auth();
  if (session?.user) redirect("/overview");

  const { error, registered, reset } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <h1 className="text-lg font-semibold tracking-tight">
            Funnel Intelligence OS
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign in to your workspace.
          </p>
        </div>

        {registered ? (
          <p className="mb-4 rounded-md bg-positive-subtle px-3 py-2 text-xs text-positive">
            Account created. Sign in to set up your workspace.
          </p>
        ) : null}

        {reset ? (
          <p className="mb-4 rounded-md bg-positive-subtle px-3 py-2 text-xs text-positive">
            Password updated. You can now sign in.
          </p>
        ) : null}

        <form action={signInAction} className="space-y-4">
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
              autoComplete="current-password"
              required
              minLength={8}
            />
          </div>

          {error ? (
            <p role="alert" className="text-xs text-negative">
              That email and password combination did not match an account.
            </p>
          ) : null}

          <Button type="submit" className="w-full">
            Sign in
          </Button>
        </form>

        <p className="mt-4 text-xs text-muted-foreground">
          <Link href="/forgot-password" className="text-accent hover:underline">
            Forgot password?
          </Link>
        </p>

        <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
          Running the demo dataset? Sign in with{" "}
          <code className="font-mono">demo@funnelintelligence.dev</code> and{" "}
          <code className="font-mono">demo1234</code>, created by{" "}
          <code className="font-mono">pnpm db:seed</code>.
        </p>

        <p className="mt-3 text-xs text-muted-foreground">
          <Link href="/register" className="text-accent hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
