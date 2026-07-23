import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json(
    {
      status: "ok",
      service: "retail-pos",
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
