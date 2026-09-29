import { NextResponse } from "next/server";
import { ensureSchema, getSql } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await ensureSchema();
    const sql = getSql();
    const period = new URL(request.url).searchParams.get("period");
    const signals = period === "week"
      ? await sql`SELECT id, username, name, description, source_username, discovered_at, company_name, summary, industry, website, location, funding_stage, confidence, research FROM discovered_accounts WHERE is_company = true AND discovered_at >= (date_trunc('week', now() AT TIME ZONE 'America/Los_Angeles') AT TIME ZONE 'America/Los_Angeles') ORDER BY discovered_at DESC LIMIT 500`
      : period === "month"
        ? await sql`SELECT id, username, name, description, source_username, discovered_at, company_name, summary, industry, website, location, funding_stage, confidence, research FROM discovered_accounts WHERE is_company = true AND discovered_at >= (date_trunc('month', now() AT TIME ZONE 'America/Los_Angeles') AT TIME ZONE 'America/Los_Angeles') ORDER BY discovered_at DESC LIMIT 500`
        : await sql`SELECT id, username, name, description, source_username, discovered_at, company_name, summary, industry, website, location, funding_stage, confidence, research FROM discovered_accounts WHERE is_company = true AND discovered_at >= (date_trunc('day', now() AT TIME ZONE 'America/Los_Angeles') AT TIME ZONE 'America/Los_Angeles') ORDER BY discovered_at DESC LIMIT 500`;
    return NextResponse.json({ signals });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load signals" }, { status: 503 });
  }
}
