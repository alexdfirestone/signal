import { NextResponse } from "next/server";
import { queueAllAccountScans } from "@/lib/queue-scan";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await queueAllAccountScans(), { status: 202 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not queue daily scan" }, { status: 503 });
  }
}
