import type { NextRequest } from "next/server";

import { corsPreflight, handleIngestRequest } from "@/server/api/ingest-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS() {
  return corsPreflight();
}

/** Accepts a single event envelope, or a `{ events: [...] }` batch. */
export async function POST(request: NextRequest) {
  return handleIngestRequest(request, { mode: "single-or-batch" });
}
