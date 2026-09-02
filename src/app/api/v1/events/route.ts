import { NextResponse, type NextRequest } from "next/server";

import { eventBatchSchema, eventEnvelopeSchema } from "@/lib/events/schema";
import { db } from "@/server/db";
import { authenticateProjectKey, ingestEvents } from "@/server/ingest";
import { checkRateLimit } from "@/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: NextRequest) {
  const key = extractKey(request);
  if (!key) {
    return json(
      { error: { code: "UNAUTHORIZED", message: "Missing project key" } },
      401,
    );
  }

  const project = await authenticateProjectKey(db, key);
  if (!project) {
    return json(
      { error: { code: "UNAUTHORIZED", message: "Invalid project key" } },
      401,
    );
  }

  const limit = await checkRateLimit(`ingest:${project.projectId}`, {
    limit: 1000,
    windowSeconds: 60,
  });
  if (!limit.allowed) {
    return json(
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
    return json(
      { error: { code: "INVALID_JSON", message: "Body must be JSON" } },
      400,
    );
  }

  // Accept either a single envelope or a `{ events: [...] }` batch.
  const batch = eventBatchSchema.safeParse(body);
  const single = batch.success ? null : eventEnvelopeSchema.safeParse(body);

  if (!batch.success && !single?.success) {
    // Report against the shape the caller actually sent. A single envelope
    // failing the batch schema would otherwise be told "expected array", which
    // says nothing about the field that is really wrong.
    const looksLikeBatch =
      typeof body === "object" && body !== null && "events" in body;
    const source = looksLikeBatch ? batch.error : (single?.error ?? batch.error);

    const issues = source.issues.map((i) => ({
      path: i.path.join("."),
      message: i.message,
    }));
    return json(
      {
        error: {
          code: "VALIDATION_FAILED",
          message: "Event payload failed validation",
          issues,
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

  return json(result, result.rejected > 0 && result.accepted === 0 ? 422 : 202);
}

function extractKey(request: NextRequest): string | null {
  const header = request.headers.get("authorization");
  if (header?.startsWith("Bearer ")) return header.slice(7).trim();

  const custom = request.headers.get("x-project-key");
  if (custom) return custom;

  // `navigator.sendBeacon` cannot set headers, so unload flushes pass the
  // publishable key as a query parameter. Secret keys are never accepted here.
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

function json(body: unknown, status: number, extra: HeadersInit = {}) {
  return NextResponse.json(body, {
    status,
    headers: { ...CORS_HEADERS, ...extra },
  });
}
