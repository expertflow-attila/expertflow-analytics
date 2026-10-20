"use server";

import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { features } from "@/env";
import { runAnalyst } from "@/server/ai/agent";
import { resolveProvider } from "@/server/ai/provider";
import {
  resolveProjectContext,
  resolveRange,
} from "@/server/analytics/context";
import { db } from "@/server/db";
import { aiConversations, aiMessages } from "@/server/db/schema";
import { assertRole } from "@/server/tenancy";

const askSchema = z.object({
  question: z.string().min(3).max(2000),
  conversationId: z.string().optional(),
});

export type AskResult =
  { error: string } | { ok: true; conversationId: string };

export async function askAnalyst(
  _prev: unknown,
  formData: FormData,
): Promise<AskResult> {
  if (!features.aiAnalyst) {
    return { error: "Az AI-elemző ebben a környezetben ki van kapcsolva." };
  }

  const parsed = askSchema.safeParse(
    {
      question: String(formData.get("question") ?? ""),
      conversationId: String(formData.get("conversationId") ?? "") || undefined,
    },
    { error: z.locales.hu().localeError },
  );

  if (!parsed.success) {
    return { error: "Írj legalább néhány szóból álló kérdést." };
  }

  const ctx = await resolveProjectContext();
  // Asking costs money and reads the whole project; viewers do not get it.
  assertRole(ctx, "ANALYST");

  const provider = resolveProvider();
  if (!provider) {
    return {
      error:
        "Nincs beállított AI-szolgáltató. Kérd az üzemeltetőt az Anthropic, OpenAI vagy Ollama csatlakoztatására.",
    };
  }

  let conversationId = parsed.data.conversationId;

  if (conversationId) {
    const [conversation] = await db
      .select({ id: aiConversations.id })
      .from(aiConversations)
      .where(
        and(
          eq(aiConversations.id, conversationId),
          eq(aiConversations.projectId, ctx.projectId),
          eq(aiConversations.organizationId, ctx.organizationId),
        ),
      )
      .limit(1);
    if (!conversation) return { error: "A beszélgetés nem található." };
  }

  if (!conversationId) {
    const [conversation] = await db
      .insert(aiConversations)
      .values({
        organizationId: ctx.organizationId,
        projectId: ctx.projectId,
        userId: ctx.userId,
        title: parsed.data.question.slice(0, 80),
      })
      .returning();
    conversationId = conversation.id;
  }

  const priorRows = await db
    .select({ role: aiMessages.role, content: aiMessages.content })
    .from(aiMessages)
    .where(eq(aiMessages.conversationId, conversationId))
    .orderBy(desc(aiMessages.createdAt))
    .limit(20);
  priorRows.reverse();

  await db.insert(aiMessages).values({
    conversationId,
    role: "user",
    content: parsed.data.question,
  });

  const { range } = resolveRange(undefined);

  try {
    const result = await runAnalyst(
      provider,
      { ctx, defaultRange: range },
      parsed.data.question,
      priorRows.filter(
        (row): row is { role: "user" | "assistant"; content: string } =>
          row.role === "user" || row.role === "assistant",
      ),
    );

    await db.insert(aiMessages).values({
      conversationId,
      role: "assistant",
      content: result.answer,
      toolTrace: result.trace.map((entry) => ({
        tool: entry.tool,
        args: entry.args,
        result: entry.result,
        durationMs: entry.durationMs,
      })),
    });
  } catch (error) {
    await db.insert(aiMessages).values({
      conversationId,
      role: "assistant",
      content:
        "Az AI-szolgáltató nem érhető el, ezért nem készült válasz. Az elemzési oldalak továbbra is használhatók.",
      toolTrace: [],
    });

    console.error("[ai] provider call failed", error);
  }

  revalidatePath("/ai");
  return { ok: true, conversationId };
}
