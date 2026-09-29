CREATE TABLE IF NOT EXISTS tracked_accounts (
  id text PRIMARY KEY,
  username text NOT NULL,
  name text NOT NULL,
  profile_image_url text,
  category text NOT NULL DEFAULT 'person',
  last_following_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  last_checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS discovered_accounts (
  id text PRIMARY KEY,
  username text NOT NULL,
  name text NOT NULL,
  description text,
  profile_image_url text,
  source_account_id text REFERENCES tracked_accounts(id) ON DELETE SET NULL,
  source_username text,
  discovered_at timestamptz NOT NULL DEFAULT now(),
  researched_at timestamptz,
  research_status text NOT NULL DEFAULT 'pending',
  research_error text,
  is_company boolean,
  company_name text,
  summary text,
  industry text,
  website text,
  location text,
  funding_stage text,
  confidence integer,
  research jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS discovered_accounts_discovered_at_idx ON discovered_accounts(discovered_at DESC);
