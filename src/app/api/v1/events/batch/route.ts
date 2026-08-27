import { NextResponse } from "next/server";
import { batchSchema } from "@/lib/event-schema";

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  if (!request.headers.get("x-project-key")) return NextResponse.json({ error: { code: "MISSING_PROJECT_KEY", message: "Provide x-project-key.", request_id: requestId } }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: { code: "INVALID_JSON", message: "Request body must be valid JSON.", request_id: requestId } }, { status: 400 }); }
  const parsed = batchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: { code: "INVALID_BATCH", message: "Batch validation failed.", request_id: requestId, fields: parsed.error.flatten().fieldErrors } }, { status: 422 });
  return NextResponse.json({ error: { code: "INGEST_NOT_CONFIGURED", message: "This deployment is a read-only demo workspace. Configure a production EventStore before accepting batches.", request_id: requestId } }, { status: 503 });
}
