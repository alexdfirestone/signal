import { NextResponse } from "next/server";
import { queueAllAccountScans } from "@/lib/queue-scan";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const budget = Number(process.env.TWITTERAPI_IO_DAILY_BUDGET_USD ?? 0);
    if (!Number.isFinite(budget) || budget <= 0) return NextResponse.json({ error: "Automatic scans are paused until TWITTERAPI_IO_DAILY_BUDGET_USD is configured." }, { status: 503 });
    return NextResponse.json(await queueAllAccountScans({ confirmCost: true, maxCostUsd: budget }), { status: 202 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not queue daily scan" }, { status: 503 });
  }
}
