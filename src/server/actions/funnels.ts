"use server";

import { and, eq, inArray, notInArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/server/db";
import {
  auditLogs,
  funnelEdges,
  funnelNodes,
  funnels,
} from "@/server/db/schema";
import { requireProject } from "@/server/tenancy";
import type { ConfigResult } from "./configuration";

const stepSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1).max(120),
  eventName: z.string().regex(/^[a-z0-9_]{1,80}$/),
  target: z.union([z.literal(""), z.coerce.number().min(0).max(100)]),
});
const schema = z
  .object({
    id: z.string().optional(),
    name: z.string().trim().min(1).max(120),
    mode: z.enum(["STRICT", "ORDERED", "FLEXIBLE"]),
    windowDays: z.coerce.number().min(1).max(365),
    steps: z.array(stepSchema).min(1).max(100),
  })
  .refine((v) => {
    const ids = v.steps.flatMap((s) => (s.id ? [s.id] : []));
    return new Set(ids).size === ids.length;
  }, "Ismétlődő lépésazonosítók.");

export async function saveFunnel(
  _: ConfigResult,
  form: FormData,
): Promise<ConfigResult> {
  const ctx = await requireProject(String(form.get("projectId") ?? ""));
  if (ctx.role !== "ADMIN" && ctx.role !== "OWNER")
    return { error: "Rendszergazdai jogosultság szükséges." };
  let raw: unknown;
  try {
    raw = JSON.parse(String(form.get("funnel")));
  } catch {
    return { error: "Érvénytelen tölcséradatok." };
  }
  const parsed = schema.safeParse(raw, { error: z.locales.hu().localeError });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const data = parsed.data;
  const result = await db.transaction(async (tx) => {
    let funnelId = data.id;
    if (funnelId) {
      const [existing] = await tx
        .select()
        .from(funnels)
        .where(
          and(
            eq(funnels.id, funnelId),
            eq(funnels.projectId, ctx.projectId),
            eq(funnels.organizationId, ctx.organizationId),
          ),
        )
        .for("update")
        .limit(1);
      if (!existing) return { error: "A tölcsér nem található." };
    }
    const ids = data.steps.flatMap((s) => (s.id ? [s.id] : []));
    if (ids.length) {
      if (!funnelId) return { error: "Érvénytelen lépésazonosítók." };
      const owned = await tx
        .select({ id: funnelNodes.id })
        .from(funnelNodes)
        .where(
          and(
            eq(funnelNodes.funnelId, funnelId),
            eq(funnelNodes.projectId, ctx.projectId),
            inArray(funnelNodes.id, ids),
          ),
        );
      if (owned.length !== ids.length)
        return { error: "Ez a lépés nem tartozik a tölcsérhez." };
    }
    const values = {
      name: data.name,
      mode: data.mode,
      conversionWindowSeconds: Math.round(data.windowDays * 86400),
      updatedAt: new Date(),
    };
    if (!funnelId) {
      const [created] = await tx
        .insert(funnels)
        .values({
          ...values,
          projectId: ctx.projectId,
          organizationId: ctx.organizationId,
        })
        .returning();
      funnelId = created.id;
    } else await tx.update(funnels).set(values).where(eq(funnels.id, funnelId));
    await tx.delete(funnelEdges).where(eq(funnelEdges.funnelId, funnelId));
    await tx
      .delete(funnelNodes)
      .where(
        and(
          eq(funnelNodes.funnelId, funnelId),
          ids.length ? notInArray(funnelNodes.id, ids) : undefined,
        ),
      );
    const saved: string[] = [];
    for (const [index, step] of data.steps.entries()) {
      const common = {
        name: step.name,
        stepIndex: index,
        targetConversionRate:
          step.target === "" ? null : Number(step.target) / 100,
        positionX: 80 + index * 260,
        positionY: 160,
      };
      if (step.id) {
        const [old] = await tx
          .select()
          .from(funnelNodes)
          .where(eq(funnelNodes.id, step.id))
          .limit(1);
        await tx
          .update(funnelNodes)
          .set({
            ...common,
            matchRule: { ...old.matchRule, eventName: step.eventName },
          })
          .where(eq(funnelNodes.id, step.id));
        saved.push(step.id);
      } else {
        const [node] = await tx
          .insert(funnelNodes)
          .values({
            ...common,
            organizationId: ctx.organizationId,
            projectId: ctx.projectId,
            funnelId,
            kind: "EVENT",
            matchRule: { eventName: step.eventName },
          })
          .returning();
        saved.push(node.id);
      }
    }
    if (saved.length > 1)
      await tx.insert(funnelEdges).values(
        saved.slice(0, -1).map((id, index) => ({
          organizationId: ctx.organizationId,
          projectId: ctx.projectId,
          funnelId,
          sourceNodeId: id,
          targetNodeId: saved[index + 1],
        })),
      );
    await tx.insert(auditLogs).values({
      organizationId: ctx.organizationId,
      projectId: ctx.projectId,
      actorUserId: ctx.userId,
      action: "funnel.saved",
      targetType: "funnel",
      targetId: funnelId,
    });
    return { id: funnelId };
  });
  if ("error" in result) return { error: result.error };
  revalidatePath("/", "layout");
  redirect(`/funnels?id=${result.id}`);
}
