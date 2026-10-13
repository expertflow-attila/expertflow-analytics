import { asc, desc, eq } from "drizzle-orm";

import { AiComposer } from "@/components/ai-composer";
import { DemoDataBanner, PageBody, PageHeader } from "@/components/page";
import { Card, CardContent } from "@/components/ui/card";
import { Badge, EmptyState } from "@/components/ui/primitives";
import { features } from "@/env";
import { isDemoDataset, resolveProjectContext } from "@/server/analytics/context";
import { resolveProvider } from "@/server/ai/provider";
import { db } from "@/server/db";
import { aiConversations, aiMessages } from "@/server/db/schema";

export const metadata = { title: "AI Analyst" };
export const dynamic = "force-dynamic";

export default async function AiPage({
  searchParams,
}: {
  searchParams: Promise<{ conversation?: string }>;
}) {
  const { conversation: conversationParam } = await searchParams;
  const ctx = await resolveProjectContext();
  const demo = await isDemoDataset(ctx);

  const provider = features.aiAnalyst ? resolveProvider() : null;

  const [latest] = conversationParam
    ? await db
        .select()
        .from(aiConversations)
        .where(eq(aiConversations.id, conversationParam))
        .limit(1)
    : await db
        .select()
        .from(aiConversations)
        .where(eq(aiConversations.projectId, ctx.projectId))
        .orderBy(desc(aiConversations.createdAt))
        .limit(1);

  // A conversation id from the query string must belong to this project.
  const conversation =
    latest && latest.projectId === ctx.projectId ? latest : null;

  const messages = conversation
    ? await db
        .select()
        .from(aiMessages)
        .where(eq(aiMessages.conversationId, conversation.id))
        .orderBy(asc(aiMessages.createdAt))
    : [];

  return (
    <>
      <PageHeader
        title="AI Analyst"
        description="Asks the same analytics engines the rest of this product uses. It cannot calculate a metric itself, and every answer shows which tools produced it."
        actions={
          provider ? (
            <Badge tone="neutral">
              {provider.id} · {provider.model}
            </Badge>
          ) : null
        }
      />

      <PageBody>
        {demo ? <DemoDataBanner /> : null}

        {!features.aiAnalyst ? (
          <EmptyState
            title="The AI Analyst is switched off"
            description="Set FEATURE_AI_ANALYST=true to enable it. Every other page works without it."
          />
        ) : !provider ? (
          <EmptyState
            title="No AI provider is configured"
            description="Set ANTHROPIC_API_KEY or OPENAI_API_KEY, or point OLLAMA_BASE_URL at a local model. The rest of the product is fully usable without one."
          />
        ) : (
          <>
            {messages.length === 0 ? (
              <EmptyState
                title="Ask about your funnel"
                description="Try: where is my biggest revenue leak, which channel brings the best customers, or what changed in the last two weeks."
              />
            ) : (
              <ul className="space-y-4">
                {messages.map((message) => (
                  <li key={message.id}>
                    {message.role === "user" ? (
                      <div className="flex justify-end">
                        <p className="max-w-2xl rounded-[var(--radius-card)] bg-accent-subtle px-4 py-2.5 text-sm text-foreground">
                          {message.content}
                        </p>
                      </div>
                    ) : (
                      <Card>
                        <CardContent className="pt-5">
                          <div className="space-y-3 text-sm leading-relaxed whitespace-pre-wrap">
                            {message.content}
                          </div>

                          {message.toolTrace && message.toolTrace.length > 0 ? (
                            <details className="mt-4 border-t border-border pt-3">
                              <summary className="cursor-pointer text-2xs font-medium tracking-wide text-muted-foreground uppercase">
                                Evidence · {message.toolTrace.length}{" "}
                                {message.toolTrace.length === 1
                                  ? "tool call"
                                  : "tool calls"}
                              </summary>

                              <div className="mt-3 space-y-3">
                                {message.toolTrace.map((entry, index) => (
                                  <div key={`${entry.tool}-${index}`}>
                                    <p className="text-2xs font-medium">
                                      {entry.tool}
                                      <span className="ml-2 font-normal text-subtle-foreground">
                                        {entry.durationMs} ms
                                      </span>
                                    </p>
                                    <pre className="mt-1 max-h-64 overflow-auto rounded-md bg-surface-muted px-3 py-2 font-mono text-2xs leading-relaxed">
                                      {JSON.stringify(entry.result, null, 2)}
                                    </pre>
                                  </div>
                                ))}
                              </div>

                              <p className="mt-3 text-2xs text-subtle-foreground">
                                This is the data the answer was written from. It
                                is the tool output, not the model&apos;s
                                reasoning.
                              </p>
                            </details>
                          ) : null}
                        </CardContent>
                      </Card>
                    )}
                  </li>
                ))}
              </ul>
            )}

            <AiComposer conversationId={conversation?.id} />
          </>
        )}
      </PageBody>
    </>
  );
}
