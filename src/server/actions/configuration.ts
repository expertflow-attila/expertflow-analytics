"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { currencySchema, timezoneSchema } from "@/lib/config-validation";
import {
  encryptSecret,
  decryptSecret,
  generateApiKey,
  hashApiKey,
} from "@/server/crypto";
import { db } from "@/server/db";
import {
  apiKeys,
  attributionConfigs,
  auditLogs,
  integrations,
  organizations,
  projects,
} from "@/server/db/schema";
import { AuthorizationError, requireProject } from "@/server/tenancy";

export type ConfigResult = { error?: string; ok?: boolean; secret?: string };
const field = (data: FormData, name: string) => String(data.get(name) ?? "");
async function admin(data: FormData) {
  try {
    const ctx = await requireProject(field(data, "projectId"));
    return ctx.role === "OWNER" || ctx.role === "ADMIN" ? ctx : null;
  } catch (error) {
    if (error instanceof AuthorizationError) return null;
    throw error;
  }
}

export async function createKey(
  _: ConfigResult,
  data: FormData,
): Promise<ConfigResult> {
  const ctx = await admin(data);
  if (!ctx) return { error: "Rendszergazdai jogosultság szükséges." };
  const parsed = z
    .object({
      name: z.string().trim().min(1).max(100),
      type: z.enum(["SECRET", "PUBLISHABLE"]),
    })
    .safeParse(Object.fromEntries(data), { error: z.locales.hu().localeError });
  if (!parsed.success) return { error: "Add meg a kulcs nevét és típusát." };
  const raw = generateApiKey(parsed.data.type === "SECRET" ? "sk" : "pk");
  await db.transaction(async (tx) => {
    const [key] = await tx
      .insert(apiKeys)
      .values({
        ...parsed.data,
        projectId: ctx.projectId,
        organizationId: ctx.organizationId,
        keyLast4: raw.slice(-4),
        keyHash: parsed.data.type === "SECRET" ? hashApiKey(raw) : null,
        keyPlain: parsed.data.type === "PUBLISHABLE" ? raw : null,
      })
      .returning();
    await tx.insert(auditLogs).values({
      organizationId: ctx.organizationId,
      projectId: ctx.projectId,
      actorUserId: ctx.userId,
      action: "api_key.created",
      targetType: "api_key",
      targetId: key.id,
    });
  });
  revalidatePath("/integrations");
  return { ok: true, secret: raw };
}

export async function revokeKey(
  _: ConfigResult,
  data: FormData,
): Promise<ConfigResult> {
  const ctx = await admin(data);
  if (!ctx) return { error: "Rendszergazdai jogosultság szükséges." };
  const changed = await db
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(apiKeys.id, field(data, "keyId")),
        eq(apiKeys.projectId, ctx.projectId),
      ),
    )
    .returning({ id: apiKeys.id });
  if (!changed.length) return { error: "A kulcs nem található." };
  await db.insert(auditLogs).values({
    organizationId: ctx.organizationId,
    projectId: ctx.projectId,
    actorUserId: ctx.userId,
    action: "api_key.revoked",
    targetType: "api_key",
    targetId: changed[0].id,
  });
  revalidatePath("/integrations");
  return { ok: true };
}

export async function saveWorkspace(
  _: ConfigResult,
  data: FormData,
): Promise<ConfigResult> {
  const ctx = await admin(data);
  if (!ctx) return { error: "Rendszergazdai jogosultság szükséges." };
  const parsed = z
    .object({
      organizationName: z.string().trim().min(2).max(120),
      projectName: z.string().trim().min(2).max(120),
      timezone: timezoneSchema,
      baseCurrency: currencySchema,
    })
    .safeParse(Object.fromEntries(data), { error: z.locales.hu().localeError });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  // Currency changes would relabel historical money. Keep it immutable once the project exists.
  if (parsed.data.baseCurrency !== ctx.baseCurrency)
    return {
      error:
        "Más alappénznemhez hozz létre külön projektet. A korábbi összegek pénzneme nem írható át.",
    };
  await db.transaction(async (tx) => {
    await tx
      .update(organizations)
      .set({
        name: parsed.data.organizationName,
        timezone: parsed.data.timezone,
      })
      .where(eq(organizations.id, ctx.organizationId));
    await tx
      .update(projects)
      .set({ name: parsed.data.projectName })
      .where(eq(projects.id, ctx.projectId));
    await tx.insert(auditLogs).values({
      organizationId: ctx.organizationId,
      projectId: ctx.projectId,
      actorUserId: ctx.userId,
      action: "workspace.updated",
      targetType: "project",
      targetId: ctx.projectId,
    });
  });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function saveAttribution(
  _: ConfigResult,
  data: FormData,
): Promise<ConfigResult> {
  const ctx = await admin(data);
  if (!ctx) return { error: "Rendszergazdai jogosultság szükséges." };
  const parsed = z
    .object({
      model: z.enum([
        "FIRST_TOUCH",
        "LAST_TOUCH",
        "LINEAR",
        "U_SHAPED",
        "POSITION_BASED",
      ]),
      windowDays: z.coerce.number().int().min(1).max(365),
      revenueEventName: z.string().regex(/^[a-z0-9_]{1,80}$/),
      firstTouchWeight: z.coerce.number().min(0).max(1),
      leadTouchWeight: z.coerce.number().min(0).max(1),
    })
    .refine(
      (v) => v.firstTouchWeight + v.leadTouchWeight <= 1,
      "A pozíciós súlyok összege legfeljebb 1 lehet.",
    )
    .safeParse(Object.fromEntries(data), { error: z.locales.hu().localeError });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const [current] = await db
    .select()
    .from(attributionConfigs)
    .where(eq(attributionConfigs.projectId, ctx.projectId))
    .limit(1);
  if (
    parsed.data.revenueEventName !==
    (current?.revenueEventName ?? "purchase_completed")
  )
    return {
      error:
        "A bevételi attribúció egyeztetett rendelésekből számol; az eseménytípus nem módosítható.",
    };
  const values = {
    ...parsed.data,
    includeDirect: data.has("includeDirect") ? "true" : "false",
    includeOrganic: data.has("includeOrganic") ? "true" : "false",
    updatedAt: new Date(),
  };
  await db.transaction(async (tx) => {
    const updated = await tx
      .update(attributionConfigs)
      .set(values)
      .where(eq(attributionConfigs.projectId, ctx.projectId))
      .returning({ id: attributionConfigs.id });
    if (!updated.length)
      await tx.insert(attributionConfigs).values({
        ...values,
        projectId: ctx.projectId,
        organizationId: ctx.organizationId,
      });
    await tx.insert(auditLogs).values({
      organizationId: ctx.organizationId,
      projectId: ctx.projectId,
      actorUserId: ctx.userId,
      action: "attribution.updated",
      targetType: "project",
      targetId: ctx.projectId,
    });
  });
  revalidatePath("/", "layout");
  return { ok: true };
}

const mappingSchema = z.object({
  event_name: z.string().min(1),
  event_id: z.string().optional(),
  timestamp: z.string().optional(),
  email: z.string().optional(),
  user_id: z.string().optional(),
  name: z.string().optional(),
  revenue_amount: z.string().optional(),
  revenue_currency: z.string().optional(),
  anonymous_id: z.string().optional(),
  properties: z.record(z.string(), z.string()).optional(),
});
export async function saveIntegration(
  _: ConfigResult,
  data: FormData,
): Promise<ConfigResult> {
  const ctx = await admin(data);
  if (!ctx) return { error: "Rendszergazdai jogosultság szükséges." };
  const provider = field(data, "provider");
  if (provider !== "stripe" && provider !== "webhook")
    return { error: "Ez a szolgáltató nem támogatott." };
  const [existing] = await db
    .select()
    .from(integrations)
    .where(
      and(
        eq(integrations.projectId, ctx.projectId),
        eq(integrations.provider, provider),
      ),
    )
    .limit(1);
  let config: Record<string, unknown> = {};
  if (existing?.encryptedConfig) {
    try {
      config = JSON.parse(decryptSecret(existing.encryptedConfig));
    } catch {
      return {
        error:
          "A mentett beállítás nem fejthető vissza. Szerkesztés előtt állítsd helyre a titkosítási kulcsot.",
      };
    }
  }
  if (field(data, "operation") !== "disconnect") {
    const secret = field(data, "secret").trim();
    if (secret && secret.length < 8)
      return { error: "Legalább 8 karakteres aláírási titkot adj meg." };
    const secretKey = provider === "stripe" ? "webhookSecret" : "secret";
    if (secret) config[secretKey] = secret;
    if (!config[secretKey])
      return { error: "Aláírási titok megadása szükséges." };
    if (provider === "webhook") {
      try {
        const raw = field(data, "mapping").trim();
        config.mapping = mappingSchema.parse(
          raw ? JSON.parse(raw) : config.mapping,
        );
      } catch {
        return {
          error: "Adj meg érvényes JSON-megfeleltetést az event_name mezővel.",
        };
      }
      const header =
        field(data, "signatureHeader").trim() ||
        String(config.signatureHeader || "x-signature");
      if (!/^[a-zA-Z0-9-]+$/.test(header))
        return { error: "Érvénytelen aláírási fejlécnév." };
      config.signatureHeader = header;
    }
  } else if (!existing) return { error: "Az integráció nem található." };
  const status =
    field(data, "operation") === "disconnect" ? "DISCONNECTED" : "CONNECTED";
  await db.transaction(async (tx) => {
    await tx
      .insert(integrations)
      .values({
        organizationId: ctx.organizationId,
        projectId: ctx.projectId,
        provider,
        displayName: provider === "stripe" ? "Stripe" : "Általános webhook",
        encryptedConfig: encryptSecret(JSON.stringify(config)),
        status,
      })
      .onConflictDoUpdate({
        target: [integrations.projectId, integrations.provider],
        set: { encryptedConfig: encryptSecret(JSON.stringify(config)), status },
      });
    await tx.insert(auditLogs).values({
      organizationId: ctx.organizationId,
      projectId: ctx.projectId,
      actorUserId: ctx.userId,
      action: `integration.${status === "CONNECTED" ? "configured" : "disconnected"}`,
      targetType: "integration",
      metadata: { provider },
    });
  });
  revalidatePath("/integrations");
  return { ok: true };
}
