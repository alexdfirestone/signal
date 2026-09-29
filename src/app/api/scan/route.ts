import { NextResponse } from "next/server";
import { queueAllAccountScans } from "@/lib/queue-scan";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const result = await queueAllAccountScans();
    return NextResponse.json(result, { status: 202 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not queue scan" }, { status: 503 });
  }
}
