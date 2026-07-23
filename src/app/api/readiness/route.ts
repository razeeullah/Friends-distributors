import { NextResponse } from "next/server";
import { db } from "@/lib/db";
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json(
      { status: "ready", service: "retail-pos" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { status: "not_ready", service: "retail-pos" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
