import { start } from "workflow/api";
import { ensureSchema, getSql, refreshScanRun } from "@/lib/db";
import { trackAccountWorkflow } from "@/workflows/research";
import { estimateFollowingReadCost, getFollowingScanLimit } from "@/lib/x-api";
import { randomUUID } from "node:crypto";

export async function queueAllAccountScans(options: { confirmCost?: boolean; username?: string; usernames?: string[]; trigger?: "cron" | "manual" } = {}) {
  // `vercel env pull` can leave VERCEL_URL defined as an empty string locally.
  // Workflow interprets any defined value as a deployed URL and then builds
  // `https://`, which fails before the first step runs.
  if (process.env.NODE_ENV !== "production" && !process.env.VERCEL_URL?.trim()) {
    delete process.env.VERCEL_URL;
  }
  await ensureSchema();
  const sql = getSql();
  const trackedAccounts = await sql`SELECT id, username, following_count FROM tracked_accounts ORDER BY created_at`;
  const requestedUsernames = [...new Set([...(options.usernames ?? []), ...(options.username ? [options.username] : [])]
    .map((username) => username.trim().replace(/^@/, "").toLowerCase())
    .filter(Boolean))];
  const accounts = requestedUsernames.length
    ? trackedAccounts.filter((account) => requestedUsernames.includes(String(account.username).toLowerCase()))
    : trackedAccounts;
  const missingUsernames = requestedUsernames.filter((username) => !accounts.some((account) => String(account.username).toLowerCase() === username));
  if (missingUsernames.length) {
    throw new Error(`Tracked account${missingUsernames.length > 1 ? "s" : ""} not found: ${missingUsernames.map((username) => `@${username}`).join(", ")}.`);
  }
  const resultLimit = getFollowingScanLimit();
  if (accounts.length && resultLimit < 1) {
    throw new Error("Scanning is paused. Set TWITTERAPI_IO_MAX_RESULTS_PER_ACCOUNT to a positive result limit.");
  }
  const estimatedMaxCostUsd = accounts.reduce((total, account) => {
    const count = account.following_count == null ? resultLimit : Math.min(Number(account.following_count), resultLimit);
    return total + estimateFollowingReadCost(count, 1);
  }, 0);
  if (!options.confirmCost) return { queued: 0, maxResultsPerAccount: resultLimit, estimatedMaxCostUsd, needsConfirmation: true, runs: [] };
  const scanRunId = randomUUID();
  await sql`INSERT INTO scan_runs (id, trigger, account_count) VALUES (${scanRunId}, ${options.trigger ?? "manual"}, ${accounts.length})`;
  const runs = [];
  for (const account of accounts) {
    const accountRunId = randomUUID();
    await sql`INSERT INTO account_scan_runs (id, scan_run_id, account_id, username)
      VALUES (${accountRunId}, ${scanRunId}, ${account.id as string}, ${account.username as string})`;
    try {
      const run = await start(trackAccountWorkflow, [{ id: account.id as string, username: account.username as string, accountRunId }]);
      await sql`UPDATE account_scan_runs SET workflow_run_id = ${run.runId} WHERE id = ${accountRunId}`;
      runs.push({ username: account.username, runId: run.runId, accountRunId });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not start workflow";
      await sql`UPDATE account_scan_runs SET status = 'failed', stage = 'queue', error = ${message.slice(0, 1000)}, finished_at = now() WHERE id = ${accountRunId}`;
      console.error("scan.queue_failed", { scanRunId, accountRunId, username: account.username, error: message });
    }
  }
  await refreshScanRun(scanRunId);
  return { scanRunId, queued: runs.length, failedToQueue: accounts.length - runs.length, maxResultsPerAccount: resultLimit, estimatedMaxCostUsd, needsConfirmation: false, runs };
}
