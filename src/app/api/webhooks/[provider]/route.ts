import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";

import { decryptSecret } from "@/server/crypto";
import { db } from "@/server/db";
import { integrations, ingestLogs, projects } from "@/server/db/schema";
import { getProvider } from "@/server/integrations";
import { checkRateLimit } from "@/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Inbound webhook endpoint: `/api/webhooks/:provider?project=prj_...`
 *
 * The project is named explicitly rather than inferred, because a signature
 * can only be verified once the per-project secret is known, and guessing
 * which project a payload belongs to before verifying it would mean trusting
 * unverified input to select a tenant.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ provider: string }> },
) {
  const startedAt = Date.now();
  const { provider: providerId } = await context.params;

  const provider = getProvider(providerId);
  if (!provider) {
    return fail(404, "UNKNOWN_PROVIDER", `No integration named ${providerId}`);
  }

  const projectId = request.nextUrl.searchParams.get("project");
  if (!projectId) {
    return fail(
      400,
      "MISSING_PROJECT",
      "Add ?project=prj_... to the webhook URL",
    );
  }

  const limit = await checkRateLimit(`webhook:${projectId}:${providerId}`, {
    limit: 600,
    windowSeconds: 60,
  });
  if (!limit.allowed) {
    return fail(429, "RATE_LIMITED", "Too many webhook deliveries");
  }

  const [row] = await db
    .select({
      integrationId: integrations.id,
      encryptedConfig: integrations.encryptedConfig,
      organizationId: projects.organizationId,
      projectId: projects.id,
      baseCurrency: projects.baseCurrency,
    })
    .from(integrations)
    .innerJoin(projects, eq(projects.id, integrations.projectId))
    .where(
      and(
        eq(integrations.projectId, projectId),
        eq(integrations.provider, providerId),
        inArray(integrations.status, ["CONNECTED", "ERROR"]),
      ),
    )
    .limit(1);

  if (!row) {
    // Deliberately vague: confirming which project ids exist to an
    // unauthenticated caller is itself a leak.
    return fail(404, "NOT_CONFIGURED", "No such integration");
  }

  let config: Record<string, unknown> = {};
  if (row.encryptedConfig) {
    try {
      config = JSON.parse(decryptSecret(row.encryptedConfig));
    } catch {
      return fail(
        500,
        "CONFIG_UNREADABLE",
        "Integration configuration could not be read",
      );
    }
  }

  // The raw body is required verbatim: signatures are computed over the exact
  // bytes sent, so re-serialising parsed JSON would break verification.
  const rawBody = await request.text();

  const verified = await provider.verify({
    rawBody,
    headers: request.headers,
    config,
  });

  if (!verified) {
    await noteFailure(row.integrationId, projectId, "SIGNATURE_INVALID");
    return fail(401, "SIGNATURE_INVALID", "Signature verification failed");
  }

  try {
    const outcome = await provider.handleWebhook({
      db,
      ctx: {
        organizationId: row.organizationId,
        projectId: row.projectId,
        baseCurrency: row.baseCurrency,
        source: providerId === "stripe" ? "STRIPE" : "WEBHOOK",
      },
      rawBody,
      headers: request.headers,
      config,
    });

    await db
      .update(integrations)
      .set({
        lastEventAt: new Date(),
        eventsReceived: sql`${integrations.eventsReceived} + 1`,
        status: "CONNECTED",
        lastError: null,
      })
      .where(
        and(
          eq(integrations.id, row.integrationId),
          ne(integrations.status, "DISCONNECTED"),
        ),
      );

    await db.insert(ingestLogs).values({
      projectId,
      source: providerId,
      accepted: outcome.action === "ignored" ? 0 : 1,
      durationMs: Date.now() - startedAt,
    });

    return NextResponse.json({ received: true, ...outcome }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await noteFailure(row.integrationId, projectId, "HANDLER_FAILED", message);

    // 500 rather than 200: providers retry on 5xx, and a handler failure means
    // the event has not been recorded. Silently swallowing it loses revenue.
    return fail(500, "HANDLER_FAILED", "Webhook could not be processed");
  }
}

async function noteFailure(
  integrationId: string,
  projectId: string,
  code: string,
  detail?: string,
) {
  await db
    .update(integrations)
    .set({
      errorCount: sql`${integrations.errorCount} + 1`,
      lastError: detail ? `${code}: ${detail.slice(0, 500)}` : code,
      status: "ERROR",
    })
    .where(
      and(
        eq(integrations.id, integrationId),
        ne(integrations.status, "DISCONNECTED"),
      ),
    );

  await db.insert(ingestLogs).values({
    projectId,
    source: "webhook",
    rejected: 1,
    errorCode: code,
    errorDetail: detail?.slice(0, 1000) ?? null,
  });
}

function fail(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}
