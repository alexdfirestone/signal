import { NextResponse } from "next/server";
import { queueAllAccountScans } from "@/lib/queue-scan";
import { ensureSchema, getSql } from "@/lib/db";
import { randomUUID } from "node:crypto";

async function recordCronFailure(message: string) {
  console.error("scan.cron_failed", { error: message });
  try {
    await ensureSchema();
    const sql = getSql();
    await sql`INSERT INTO scan_runs (id, trigger, status, finished_at, error)
      VALUES (${randomUUID()}, 'cron', 'failed', now(), ${message.slice(0, 1000)})`;
  } catch (error) {
    console.error("scan.cron_failure_record_failed", error);
  }
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const budget = Number(process.env.TWITTERAPI_IO_DAILY_BUDGET_USD ?? 0);
    if (!Number.isFinite(budget) || budget <= 0) {
      const message = "Automatic scans are paused until TWITTERAPI_IO_DAILY_BUDGET_USD is configured.";
      await recordCronFailure(message);
      return NextResponse.json({ error: message }, { status: 503 });
    }
    return NextResponse.json(await queueAllAccountScans({ confirmCost: true, maxCostUsd: budget, trigger: "cron" }), { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not queue daily scan";
    await recordCronFailure(message);
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
