import { NextResponse } from "next/server";
import { ensureSchema, getSql } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await ensureSchema();
    const sql = getSql();
    const params = new URL(request.url).searchParams;
    const period = params.get("period");
    if (period === "all") {
      const offset = Math.max(0, Number.parseInt(params.get("offset") ?? "0", 10) || 0);
      const query = (params.get("q") ?? "").trim().toLowerCase().slice(0, 100);
      const rows = query
        ? await sql`SELECT id, username, name, source_username, discovered_at, company_name, summary, industry, website, location
          FROM discovered_accounts WHERE is_company = true
          AND position(${query} in lower(coalesce(username, '') || ' ' || coalesce(name, '') || ' ' || coalesce(company_name, '') || ' ' || coalesce(summary, '') || ' ' || coalesce(industry, '') || ' ' || coalesce(website, '') || ' ' || coalesce(location, '') || ' ' || coalesce(source_username, ''))) > 0
          ORDER BY discovered_at DESC, id DESC LIMIT 101 OFFSET ${offset}`
        : await sql`SELECT id, username, name, source_username, discovered_at, company_name, summary, industry, website, location
          FROM discovered_accounts WHERE is_company = true ORDER BY discovered_at DESC, id DESC LIMIT 101 OFFSET ${offset}`;
      return NextResponse.json({ signals: rows.slice(0, 100), hasMore: rows.length > 100 });
    }
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
