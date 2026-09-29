# Signal

Signal tracks public X accounts and looks for new accounts they follow. New accounts go through a durable Vercel Workflow that qualifies the public profile with an LLM and stores company leads in Neon Postgres.

## Local setup

1. Install dependencies with `npm install`.
2. Run `vercel link` and `vercel env pull .env.local` to load Neon and Vercel's short-lived `VERCEL_OIDC_TOKEN` for AI Gateway. Set `X_BEARER_TOKEN` and `CRON_SECRET` in `.env.local`.
3. Run `npm run dev`.
4. Add an X handle from the watchlist. The app takes a baseline of its current follows, so the first scan processes only later follow changes.
5. Click **Run scan now** to queue per-account workflows. On Vercel, `/api/cron/daily-scan` runs every day at 8 AM PT.

`ensureSchema()` creates the prototype tables on first API use. It adds one `category` column to an existing `tracked_accounts` table if needed. The schema is also documented in `db/schema.sql`.

## Data and pipeline

- `tracked_accounts` stores one replaceable snapshot of the last seen followed X user IDs per account. A scan compares the current graph to that previous snapshot and replaces it in place, so snapshot storage stays bounded instead of growing every day.
- `discovered_accounts` stores every newly seen account, including people and organizations that do not qualify as companies. A profile is written with `research_status = 'pending'` before the AI step, then enriched with the classification, rationale, and web sources. Failed research stays in the table for later retry/refinement. The dashboard filters to `is_company = true` and shows those leads in today, this week, and this month views.
- Tracked X accounts can be categorized as Investor, Influencer, Executive, or Person. Person covers a personal account such as your own.
- The workflow steps fetch current follows, compare the snapshot, save every delta, and run a bounded AI SDK `ToolLoopAgent` through Vercel AI Gateway with OpenAI web search and structured output. Vercel Workflow provides durable step execution and retries.
- X access is read-only. Use an X API bearer token with access to the `users/by/username` and `users/:id/following` endpoints. API plan limits and follow-list pagination limit how many accounts can be tracked.

This is an early prototype: it has no authentication or multi-tenant isolation, and the demo dashboard currently displays seeded sample data. Configure the environment variables and connect the dashboard to `/api/tracked-accounts` and `/api/signals` before using it with real users.
