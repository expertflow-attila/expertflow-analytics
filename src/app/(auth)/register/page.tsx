import Link from "next/link";
import { AuthCard, Field, SubmitButton } from "@/components/auth-card";
import { registerAction } from "../actions";

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <AuthCard title="Create your account" subtitle="Start with one organization and one analytics project. You can add more later." footer={<>Already registered? <Link className="text-foreground underline" href="/login">Sign in</Link></>}>
    {error && <p role="alert" className="mb-5 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error === "exists" ? "An account already uses this email." : "Check the form. Passwords need at least 10 characters."}</p>}
    <form action={registerAction} className="grid gap-5"><Field label="Name" name="name" /><Field label="Email" name="email" type="email" /><Field label="Password" name="password" type="password" /><SubmitButton>Create account</SubmitButton></form>
  </AuthCard>;
}

