import { NextResponse } from "next/server";
import { ensureSchema, getSql } from "@/lib/db";
import { getFollowing, lookupXUser } from "@/lib/x-api";

export const runtime = "nodejs";

export async function GET() {
  try {
    await ensureSchema();
    const sql = getSql();
    const accounts = await sql`SELECT id, username, name, profile_image_url, category, last_checked_at, created_at FROM tracked_accounts ORDER BY created_at DESC`;
    return NextResponse.json({ accounts });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load tracked accounts" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { username?: string; category?: string };
    const username = body.username?.trim().replace(/^@/, "");
    const category = body.category ?? "person";
    if (!username || !/^[A-Za-z0-9_]{1,15}$/.test(username)) return NextResponse.json({ error: "Enter a valid X username" }, { status: 400 });
    if (!["investor", "influencer", "executive", "person"].includes(category)) return NextResponse.json({ error: "Choose a valid account type" }, { status: 400 });
    await ensureSchema();
    const sql = getSql();
    const [count] = await sql`SELECT count(*)::int AS count FROM tracked_accounts`;
    if (Number(count.count) >= 10) return NextResponse.json({ error: "The prototype supports up to 10 accounts" }, { status: 409 });
    const user = await lookupXUser(username);
    const baseline = await getFollowing(user.id, 10);
    await sql`INSERT INTO tracked_accounts (id, username, name, profile_image_url, category, last_following_ids, last_checked_at)
      VALUES (${user.id}, ${user.username}, ${user.name}, ${user.profile_image_url ?? null}, ${category}, ${JSON.stringify(baseline.map((person) => person.id))}::jsonb, now())
      ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username, name = EXCLUDED.name, profile_image_url = EXCLUDED.profile_image_url, category = EXCLUDED.category`;
    return NextResponse.json({ account: { ...user, category }, baselineFollowing: baseline.length }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not add X account" }, { status: 503 });
  }
}
