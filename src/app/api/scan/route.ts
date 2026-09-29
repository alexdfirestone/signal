import { NextResponse } from "next/server";
import { queueAllAccountScans } from "@/lib/queue-scan";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({})) as { confirmCost?: boolean; username?: string; usernames?: string[] };
    const result = await queueAllAccountScans({ confirmCost: body.confirmCost === true, username: body.username, usernames: body.usernames });
    return NextResponse.json(result, { status: result.needsConfirmation ? 200 : 202 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not queue scan" }, { status: 503 });
  }
}
