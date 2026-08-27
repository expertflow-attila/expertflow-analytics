import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({ status: "ok", mode: process.env.DATABASE_URL ? "connected" : "demo-read-only", timestamp: new Date().toISOString() });
}
