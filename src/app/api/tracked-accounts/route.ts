import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { ensureSchema, getSql } from "@/lib/db";
import { estimateFollowingReadCost, estimateUserLookupCost, getFollowingScanLimit, lookupXUser } from "@/lib/x-api";
import { trackAccountWorkflow } from "@/workflows/research";
import { randomUUID } from "node:crypto";

export const runtime = "nodejs";

export async function GET() {
  try {
    await ensureSchema();
    const sql = getSql();
    const accounts = await sql`SELECT id, username, name, profile_image_url, category, followers_count, following_count, last_checked_at, created_at FROM tracked_accounts ORDER BY created_at DESC`;
    return NextResponse.json({ accounts });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load tracked accounts" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    // An empty URL from `vercel env pull` breaks local workflow dispatch.
    if (process.env.NODE_ENV !== "production" && !process.env.VERCEL_URL?.trim()) {
      delete process.env.VERCEL_URL;
    }
    const body = await request.json() as { username?: string; category?: string; confirmCost?: boolean };
    const username = body.username?.trim().replace(/^@/, "");
    const category = body.category ?? "person";
    if (!username || !/^[A-Za-z0-9_]{1,15}$/.test(username)) return NextResponse.json({ error: "Enter a valid X username" }, { status: 400 });
    if (!["investor", "influencer", "executive", "person"].includes(category)) return NextResponse.json({ error: "Choose a valid account type" }, { status: 400 });
    await ensureSchema();
    const sql = getSql();
    if (getFollowingScanLimit() < 1) return NextResponse.json({ error: "Adding accounts is paused. Set TWITTERAPI_IO_MAX_RESULTS_PER_ACCOUNT to a positive result limit." }, { status: 503 });
    const user = await lookupXUser(username);
    const followersCount = user.public_metrics?.followers_count ?? null;
    const followingCount = user.public_metrics?.following_count ?? null;
    const baselineLimit = followingCount == null ? getFollowingScanLimit() : Math.min(getFollowingScanLimit(), followingCount);
    const estimatedMaxCostUsd = estimateUserLookupCost(1) + estimateFollowingReadCost(baselineLimit, 1);
    if (body.confirmCost !== true) {
      return NextResponse.json({ needsConfirmation: true, account: { username: user.username, name: user.name }, estimatedMaxCostUsd });
    }
    await sql`INSERT INTO tracked_accounts (id, username, name, profile_image_url, category, followers_count, following_count, last_following_ids)
      VALUES (${user.id}, ${user.username}, ${user.name}, ${user.profile_image_url ?? null}, ${category}, ${followersCount}, ${followingCount}, ${JSON.stringify([])}::jsonb)
      ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username, name = EXCLUDED.name, profile_image_url = EXCLUDED.profile_image_url, category = EXCLUDED.category, followers_count = EXCLUDED.followers_count, following_count = EXCLUDED.following_count`;
    const accountRunId = randomUUID();
    await sql`INSERT INTO account_scan_runs (id, account_id, username) VALUES (${accountRunId}, ${user.id}, ${user.username})`;
    let initialRun;
    try {
      initialRun = await start(trackAccountWorkflow, [{ id: user.id, username: user.username, accountRunId }]);
      await sql`UPDATE account_scan_runs SET workflow_run_id = ${initialRun.runId} WHERE id = ${accountRunId}`;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Could not start initial sync";
      await sql`UPDATE account_scan_runs SET status = 'failed', error = ${message.slice(0, 1000)}, finished_at = now() WHERE id = ${accountRunId}`;
      throw cause;
    }
    return NextResponse.json({ account: { ...user, followers_count: followersCount, following_count: followingCount, category }, syncQueued: true, initialResearchRunId: initialRun.runId, estimatedMaxCostUsd }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not add X account" }, { status: 503 });
  }
}
