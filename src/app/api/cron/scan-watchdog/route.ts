import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { ensureSchema, getSql } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    await ensureSchema();
    const sql = getSql();
    const [recent] = await sql`SELECT id FROM scan_runs
      WHERE trigger = 'cron' AND started_at >= now() - interval '3 hours'
      ORDER BY started_at DESC LIMIT 1`;
    if (recent) return NextResponse.json({ ok: true, scanRunId: recent.id });
    const id = randomUUID();
    const message = "No daily scan invocation was recorded within three hours of the scheduled run.";
    await sql`INSERT INTO scan_runs (id, trigger, status, finished_at, error)
      VALUES (${id}, 'cron', 'failed', now(), ${message})`;
    console.error("scan.cron_missed", { scanRunId: id, error: message });
    return NextResponse.json({ error: message, scanRunId: id }, { status: 503 });
  } catch (error) {
    console.error("scan.watchdog_failed", error);
    return NextResponse.json({ error: "Could not check daily scan" }, { status: 503 });
  }
}
