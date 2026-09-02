import { hash } from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, sql } from "@/db";
import { organizationMemberships, organizations, projects, users } from "@/db/schema";

async function seed() {
  const email = "demo@funnel.local";
  const [found] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (found) { console.info("Seed already exists."); return; }
  await db.transaction(async (tx) => {
    const [user] = await tx.insert(users).values({ email, name: "Demo Owner", passwordHash: await hash("DemoPassword123!", 12), emailVerifiedAt: new Date() }).returning();
    const [organization] = await tx.insert(organizations).values({ name: "Funnel Intelligence Demo", slug: "funnel-intelligence-demo", timezone: "Europe/Budapest", defaultCurrency: "EUR" }).returning();
    await tx.insert(organizationMemberships).values({ organizationId: organization.id, userId: user.id, role: "OWNER" });
    await tx.insert(projects).values({ organizationId: organization.id, name: "AI Consulting Funnel", slug: "ai-consulting-funnel", timezone: "Europe/Budapest", baseCurrency: "EUR" });
  });
  console.info("Development seed created: demo@funnel.local");
}
seed().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => sql.end());

