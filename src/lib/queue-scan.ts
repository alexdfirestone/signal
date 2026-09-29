import { start } from "workflow/api";
import { ensureSchema, getSql } from "@/lib/db";
import { trackAccountWorkflow } from "@/workflows/research";
import { estimateFollowingReadCost, getFollowingScanLimit } from "@/lib/x-api";

export async function queueAllAccountScans(options: { confirmCost?: boolean; maxCostUsd?: number; username?: string; usernames?: string[] } = {}) {
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
  if (options.maxCostUsd != null && estimatedMaxCostUsd > options.maxCostUsd) {
    throw new Error(`Scan stopped: estimated twitterapi.io cost is up to $${estimatedMaxCostUsd.toFixed(4)}, above the configured $${options.maxCostUsd.toFixed(2)} budget.`);
  }
  if (!options.confirmCost) return { queued: 0, maxResultsPerAccount: resultLimit, estimatedMaxCostUsd, needsConfirmation: true, runs: [] };
  const runs = await Promise.all(accounts.map(async (account) => {
    const run = await start(trackAccountWorkflow, [{ id: account.id as string, username: account.username as string }]);
    return { username: account.username, runId: run.runId };
  }));
  return { queued: runs.length, maxResultsPerAccount: resultLimit, estimatedMaxCostUsd, needsConfirmation: false, runs };
}
