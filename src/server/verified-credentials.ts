import { compare } from "bcryptjs";
import { eq } from "drizzle-orm";
import { CredentialsSignin } from "next-auth";
import { z } from "zod";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";

class EmailNotVerified extends CredentialsSignin {
  code = "email_unverified";
}

export async function authorizeVerifiedCredentials(raw: unknown) {
  const parsed = z
    .object({
      email: z.string().trim().toLowerCase().email().max(254),
      password: z.string().min(8),
    })
    .safeParse(raw);
  if (!parsed.success) return null;
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, parsed.data.email))
    .limit(1);
  if (
    !user?.passwordHash ||
    !(await compare(parsed.data.password, user.passwordHash))
  )
    return null;
  if (!user.emailVerifiedAt) throw new EmailNotVerified();
  return { id: user.id, email: user.email, name: user.name };
}

export async function isVerifiedUser(id: string): Promise<boolean> {
  const [user] = await db
    .select({ verified: users.emailVerifiedAt })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  return Boolean(user?.verified);
}
