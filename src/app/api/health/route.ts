import { NextResponse } from "next/server";
import { sql } from "@/db";

export const dynamic = "force-dynamic";
export async function GET() {
  try { await sql`select 1`; return NextResponse.json({ status: "ok", database: "ok" }); }
  catch { return NextResponse.json({ status: "degraded", database: "unhealthy" }, { status: 503 }); }
}

