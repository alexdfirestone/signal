import { start } from "workflow/api";
import { ensureSchema, getSql } from "@/lib/db";
import { trackAccountWorkflow } from "@/workflows/research";

export async function queueAllAccountScans() {
  await ensureSchema();
  const sql = getSql();
  const accounts = await sql`SELECT id, username FROM tracked_accounts ORDER BY created_at`;
  const runs = await Promise.all(accounts.map(async (account) => {
    const run = await start(trackAccountWorkflow, [{ id: account.id as string, username: account.username as string }]);
    return { username: account.username, runId: run.runId };
  }));
  return { queued: runs.length, runs };
}
