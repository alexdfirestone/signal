import { NextResponse } from "next/server";
import { ensureSchema, getSql } from "@/lib/db";

export const runtime = "nodejs";
const categories = ["investor", "influencer", "executive", "person"];

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { category } = await request.json() as { category?: string };
    if (!category || !categories.includes(category)) return NextResponse.json({ error: "Choose a valid account type" }, { status: 400 });
    await ensureSchema();
    const sql = getSql();
    const rows = await sql`UPDATE tracked_accounts SET category = ${category} WHERE id = ${id} RETURNING id, username, name, category, last_checked_at`;
    if (!rows.length) return NextResponse.json({ error: "Tracked account not found" }, { status: 404 });
    return NextResponse.json({ account: rows[0] });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not update account" }, { status: 503 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await ensureSchema();
    const sql = getSql();
    const rows = await sql`DELETE FROM tracked_accounts WHERE id = ${id} RETURNING id`;
    if (!rows.length) return NextResponse.json({ error: "Tracked account not found" }, { status: 404 });
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not remove account" }, { status: 503 });
  }
}
