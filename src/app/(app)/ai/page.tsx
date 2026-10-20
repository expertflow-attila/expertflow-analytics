import { asc, desc, eq } from "drizzle-orm";

import { AiComposer } from "@/components/ai-composer";
import { DemoDataBanner, PageBody, PageHeader } from "@/components/page";
import { Card, CardContent } from "@/components/ui/card";
import { Badge, EmptyState } from "@/components/ui/primitives";
import { features } from "@/env";
import {
  isDemoDataset,
  resolveProjectContext,
} from "@/server/analytics/context";
import { resolveProvider } from "@/server/ai/provider";
import { db } from "@/server/db";
import { aiConversations, aiMessages } from "@/server/db/schema";

export const metadata = { title: "AI-elemző" };
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
        title="AI-elemző"
        description="A válaszok az alkalmazás elemzőmotorjaira támaszkodnak. Minden megállapítás mellett ellenőrizhető, mely adatok és eszközök támasztják alá."
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
            title="Az AI-elemző ki van kapcsolva"
            description="Az AI-elemzőt az üzemeltető kapcsolhatja be. Az alkalmazás többi része nélküle is használható."
          />
        ) : !provider ? (
          <EmptyState
            title="Nincs beállított AI-szolgáltató"
            description="Az üzemeltető csatlakoztathat Anthropic- vagy OpenAI-szolgáltatást, illetve helyi Ollama-modellt. Az elemzési oldalak ezek nélkül is használhatók."
          />
        ) : (
          <>
            {messages.length === 0 ? (
              <EmptyState
                title="Kérdezz az értékesítési tölcséredről"
                description="Például: hol veszítünk a legtöbb bevételt, melyik csatorna hozza a legértékesebb ügyfeleket, vagy mi változott az elmúlt két hétben?"
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
                                Forrásadatok · {message.toolTrace.length}{" "}
                                {message.toolTrace.length === 1
                                  ? "eszközhívás"
                                  : "eszközhívás"}
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
                                A válasz alapjául szolgáló adatok és
                                eszközeredmények. Ez nem a modell belső
                                gondolatmenete.
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
