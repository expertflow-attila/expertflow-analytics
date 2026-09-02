import Link from "next/link";
import { AuthCard, Field, SubmitButton } from "@/components/auth-card";
import { loginAction } from "../actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <AuthCard title="Welcome back" subtitle="Sign in to see what is happening in your funnel and what deserves attention next." footer={<>No account yet? <Link className="text-foreground underline" href="/register">Create one</Link></>}>
    {error && <p role="alert" className="mb-5 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">The email or password is not valid.</p>}
    <form action={loginAction} className="grid gap-5"><Field label="Email" name="email" type="email" /><Field label="Password" name="password" type="password" /><SubmitButton>Sign in</SubmitButton></form>
  </AuthCard>;
}

