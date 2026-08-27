import { NextResponse } from "next/server";
import { eventSchema } from "@/lib/event-schema";

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  const key = request.headers.get("x-project-key");
  if (!key) return NextResponse.json({ error: { code: "MISSING_PROJECT_KEY", message: "Provide x-project-key.", request_id: requestId } }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: { code: "INVALID_JSON", message: "Request body must be valid JSON.", request_id: requestId } }, { status: 400 }); }
  const parsed = eventSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: { code: "INVALID_EVENT", message: "Event validation failed.", request_id: requestId, fields: parsed.error.flatten().fieldErrors } }, { status: 422 });
  if (!process.env.DATABASE_URL || !process.env.EVENT_INGEST_SECRET) return NextResponse.json({ error: { code: "INGEST_NOT_CONFIGURED", message: "This deployment is a read-only demo workspace. Configure storage and an ingest secret before accepting events.", request_id: requestId } }, { status: 503 });
  return NextResponse.json({ error: { code: "STORE_ADAPTER_REQUIRED", message: "A production EventStore adapter must be installed for this deployment.", request_id: requestId } }, { status: 501 });
}
