import { NextResponse, type NextRequest } from "next/server";

import { eventBatchSchema, eventEnvelopeSchema } from "@/lib/events/schema";
import { db } from "@/server/db";
import { authenticateProjectKey, ingestEvents } from "@/server/ingest";
import { checkRateLimit } from "@/server/rate-limit";

/**
 * Shared request handling for the public ingestion endpoints.
 *
 * `/api/v1/events` and `/api/v1/events/batch` differ only in what payload
 * shape they accept; every other concern — authentication, rate limiting,
 * CORS, error shape — is identical, and must stay identical.
 */

export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Project-Key",
  "Access-Control-Max-Age": "86400",
};

export function corsPreflight() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export function apiJson(
  body: unknown,
  status: number,
  extra: HeadersInit = {},
) {
  return NextResponse.json(body, {
    status,
    headers: { ...CORS_HEADERS, ...extra },
  });
}

export async function handleIngestRequest(
  request: NextRequest,
  options: { mode: "single-or-batch" | "batch-only" },
) {
  const key = extractKey(request);
  if (!key) {
    return apiJson(
      { error: { code: "UNAUTHORIZED", message: "Missing project key" } },
      401,
    );
  }

  const project = await authenticateProjectKey(db, key);
  if (!project) {
    return apiJson(
      { error: { code: "UNAUTHORIZED", message: "Invalid project key" } },
      401,
    );
  }

  const limit = await checkRateLimit(`ingest:${project.projectId}`, {
    limit: 1000,
    windowSeconds: 60,
  });
  if (!limit.allowed) {
    return apiJson(
      {
        error: {
          code: "RATE_LIMITED",
          message: "Too many events; retry after the window resets",
        },
      },
      429,
      { "Retry-After": String(limit.retryAfterSeconds) },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiJson(
      { error: { code: "INVALID_JSON", message: "Body must be JSON" } },
      400,
    );
  }

  const batch = eventBatchSchema.safeParse(body);
  const single =
    options.mode === "batch-only" || batch.success
      ? null
      : eventEnvelopeSchema.safeParse(body);

  if (!batch.success && !single?.success) {
    // Report against the shape the caller actually sent. A single envelope
    // judged by the batch schema would otherwise be told "expected array",
    // which says nothing about the field that is really wrong.
    const looksLikeBatch =
      options.mode === "batch-only" ||
      (typeof body === "object" && body !== null && "events" in body);

    const source = looksLikeBatch ? batch.error : (single?.error ?? batch.error);

    return apiJson(
      {
        error: {
          code: "VALIDATION_FAILED",
          message: "Event payload failed validation",
          issues: source.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
      },
      422,
    );
  }

  const envelopes = batch.success ? batch.data.events : [single!.data!];

  const result = await ingestEvents(
    db,
    {
      organizationId: project.organizationId,
      projectId: project.projectId,
      baseCurrency: project.baseCurrency,
      selfHost: hostOf(request.headers.get("origin")),
      source: key.startsWith("sk_") ? "api" : "sdk",
    },
    envelopes,
  );

  // A batch where nothing at all could be stored is a client error; a batch
  // where some events landed is accepted, with the failures itemised.
  const status = result.accepted === 0 && result.rejected > 0 ? 422 : 202;
  return apiJson(result, status);
}

function extractKey(request: NextRequest): string | null {
  const header = request.headers.get("authorization");
  if (header?.startsWith("Bearer ")) return header.slice(7).trim();

  const custom = request.headers.get("x-project-key");
  if (custom) return custom;

  // `navigator.sendBeacon` cannot set headers, so unload flushes pass the
  // publishable key as a query parameter. Secret keys are never accepted
  // there — a secret key in a URL ends up in server and proxy logs.
  const query = request.nextUrl.searchParams.get("key");
  return query?.startsWith("pk_") ? query : null;
}

function hostOf(origin: string | null): string | null {
  if (!origin) return null;
  try {
    return new URL(origin).hostname;
  } catch {
    return null;
  }
}
