import { neon } from "@neondatabase/serverless";

export function getSql() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not configured");
  return neon(connectionString);
}

export async function ensureSchema() {
  const sql = getSql();
  await sql`CREATE TABLE IF NOT EXISTS tracked_accounts (
    id text PRIMARY KEY, username text NOT NULL, name text NOT NULL, profile_image_url text,
    category text NOT NULL DEFAULT 'person', followers_count bigint, following_count bigint, last_following_ids jsonb NOT NULL DEFAULT '[]'::jsonb, last_checked_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
  )`;
  await sql`ALTER TABLE tracked_accounts ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'person'`;
  await sql`ALTER TABLE tracked_accounts ADD COLUMN IF NOT EXISTS followers_count bigint`;
  await sql`ALTER TABLE tracked_accounts ADD COLUMN IF NOT EXISTS following_count bigint`;
  await sql`CREATE TABLE IF NOT EXISTS discovered_accounts (
    id text PRIMARY KEY, username text NOT NULL, name text NOT NULL, description text,
    profile_image_url text, source_account_id text REFERENCES tracked_accounts(id) ON DELETE SET NULL,
    source_username text, discovered_at timestamptz NOT NULL DEFAULT now(),
    researched_at timestamptz, research_status text NOT NULL DEFAULT 'pending', research_error text,
    is_company boolean, company_name text, summary text,
    industry text, website text, location text, funding_stage text, confidence integer,
    research jsonb NOT NULL DEFAULT '{}'::jsonb
  )`;
  await sql`ALTER TABLE discovered_accounts ADD COLUMN IF NOT EXISTS research_status text NOT NULL DEFAULT 'pending'`;
  await sql`ALTER TABLE discovered_accounts ADD COLUMN IF NOT EXISTS research_error text`;
  await sql`CREATE INDEX IF NOT EXISTS discovered_accounts_discovered_at_idx ON discovered_accounts(discovered_at DESC)`;
  await sql`CREATE TABLE IF NOT EXISTS scan_runs (
    id text PRIMARY KEY, trigger text NOT NULL, status text NOT NULL DEFAULT 'queueing',
    started_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz,
    account_count integer NOT NULL DEFAULT 0, error text
  )`;
  await sql`CREATE TABLE IF NOT EXISTS account_scan_runs (
    id text PRIMARY KEY, scan_run_id text REFERENCES scan_runs(id) ON DELETE SET NULL,
    account_id text, username text NOT NULL, workflow_run_id text,
    status text NOT NULL DEFAULT 'queued', stage text NOT NULL DEFAULT 'queue',
    started_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz,
    new_follows integer NOT NULL DEFAULT 0, researched integer NOT NULL DEFAULT 0,
    startups integer NOT NULL DEFAULT 0, research_failed integer NOT NULL DEFAULT 0,
    error text
  )`;
  await sql`CREATE INDEX IF NOT EXISTS account_scan_runs_account_time_idx ON account_scan_runs(account_id, started_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS account_scan_runs_batch_idx ON account_scan_runs(scan_run_id)`;
  await sql`CREATE TABLE IF NOT EXISTS account_scan_follows (
    account_scan_run_id text NOT NULL REFERENCES account_scan_runs(id) ON DELETE CASCADE,
    discovered_account_id text NOT NULL REFERENCES discovered_accounts(id) ON DELETE CASCADE,
    PRIMARY KEY (account_scan_run_id, discovered_account_id)
  )`;
}

export async function refreshScanRun(scanRunId: string) {
  const sql = getSql();
  const [counts] = await sql`SELECT count(*)::integer AS total,
    count(*) FILTER (WHERE status IN ('queued', 'running'))::integer AS active,
    count(*) FILTER (WHERE status IN ('failed', 'partial'))::integer AS issues
    FROM account_scan_runs WHERE scan_run_id = ${scanRunId}`;
  const active = Number(counts.active);
  const issues = Number(counts.issues);
  const status = active ? "running" : issues ? "partial" : "complete";
  await sql`UPDATE scan_runs SET status = ${status}, finished_at = ${active ? null : new Date().toISOString()}
    WHERE id = ${scanRunId}`;
}
