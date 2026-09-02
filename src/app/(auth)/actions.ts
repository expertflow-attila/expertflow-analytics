"use server";
import { hash } from "bcryptjs";
import { eq } from "drizzle-orm";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { signIn, signOut } from "@/auth";
import { loginSchema, registerSchema } from "@/lib/validation/domain";

export async function loginAction(formData: FormData) {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/login?error=invalid");
  try { await signIn("credentials", { ...parsed.data, redirectTo: "/" }); }
  catch (error) { if (error instanceof AuthError) redirect("/login?error=credentials"); throw error; }
}

export async function registerAction(formData: FormData) {
  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/register?error=invalid");
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, parsed.data.email)).limit(1);
  if (existing) redirect("/register?error=exists");
  await db.insert(users).values({ name: parsed.data.name, email: parsed.data.email, passwordHash: await hash(parsed.data.password, 12) });
  await signIn("credentials", { email: parsed.data.email, password: parsed.data.password, redirectTo: "/onboarding" });
}

export async function logoutAction() { await signOut({ redirectTo: "/login" }); }

