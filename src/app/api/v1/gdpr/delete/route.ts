import { NextResponse } from "next/server";

/**
 * GDPR Article 17 — Right to erasure.
 * Soft-deletes or hard-deletes all data linked to a person_id.
 * Must be idempotent and logged.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { person_id, email, confirm } = body;

  if (!person_id && !email) {
    return NextResponse.json({ error: "person_id or email required" }, { status: 400 });
  }
  if (confirm !== true) {
    return NextResponse.json({ error: "confirm: true required for deletion" }, { status: 400 });
  }

  // Placeholder: real implementation queues a deletion job
  return NextResponse.json({
    status: "queued",
    subject: { person_id, email },
    message: "Deletion request accepted. Demo mode — no data was removed."
  });
}
