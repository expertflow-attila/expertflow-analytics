import { NextResponse } from "next/server";

/**
 * GDPR Article 15 — Right of access.
 * Returns a JSON bundle of all data linked to a person_id or email.
 * In production this must be tenant-scoped and authenticated.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const personId = searchParams.get("person_id");
  const email = searchParams.get("email");

  if (!personId && !email) {
    return NextResponse.json({ error: "person_id or email required" }, { status: 400 });
  }

  // Placeholder: real implementation queries EventStore + identity graph
  const bundle = {
    exported_at: new Date().toISOString(),
    subject: { person_id: personId, email },
    events: [],
    identities: [],
    revenue: [],
    note: "Demo endpoint — no live data. Configure EventStore to enable real export."
  };

  return NextResponse.json(bundle, {
    headers: {
      "Content-Disposition": `attachment; filename="gdpr-export-${personId || email}.json"`
    }
  });
}
