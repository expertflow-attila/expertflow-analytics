import type { NextRequest } from "next/server";

import { corsPreflight, handleIngestRequest } from "@/server/api/ingest-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS() {
  return corsPreflight();
}

/**
 * Batch-only ingestion. Rejects a bare envelope so a client that meant to send
 * a batch is told exactly that, rather than silently having one event accepted.
 */
export async function POST(request: NextRequest) {
  return handleIngestRequest(request, { mode: "batch-only" });
}
