# Signal MCP: initial implementation

## Scope

Expose published startup profiles to Claude, Codex, and other MCP clients. Customers can search for companies added to Signal recently and inspect a full profile. Discovery sources (tracked accounts, X follow relationships, scans) remain private.

## Repository and runtime

Use npm workspaces: `apps/web` for the existing Next.js app, `apps/mcp` for a Node.js MCP server, and `packages/core` for shared company queries and public response schemas. Both apps use Neon. Deploy the MCP as a hosted Streamable HTTP endpoint at `/mcp`; use an official MCP SDK. Keep scan and research workflows in the web app.

## Data contract

Add a stable `companies` identity and link existing `discovered_accounts` records to it. Publish only screened, usable profiles. A public profile contains company name, summary, industry, website, supported stage, verified people and roles, evidence URLs, and `added_at`/`researched_at`. `added_at` means first added to Signal, not founded. Build public responses from an explicit field allowlist; never serialize internal discovery rows directly.

| MCP tool | Input | Output | Initial price |
| --- | --- | --- | ---: |
| `search_companies` | Criteria, `added_after`, `added_before`, `limit`, cursor | Brief previews and next cursor | $0 |
| `get_company` | Stable company ID | Full profile, evidence, charge result | $1 on first workspace unlock |
| `get_workspace_balance` | None | Available dollars and recent usage | $0 |

Cap search pages at 20 results. Return explicit unknown values for unverified people or stage. Search and detail use the same published-company filter. Tool errors and incomplete profiles are never charged.

## Access and billing

Each authenticated MCP connection resolves to a workspace and member. The workspace owns a shared dollar balance and company unlocks. Workspace owners can invite members and buy $5, $20, $50, or $100 through Stripe Checkout; a verified webhook adds funds once per payment. Grant each new workspace three free company unlocks. Keep private operational APIs behind separate internal authorization; a later customer REST API reuses the MCP's public schema and billing service.

Store pricing in a versioned config file (`search=$0`, `first_company_unlock=$1`, `repeat_read=$0`, `balance=$0`). Meter successful tool outcomes in an append-only ledger with workspace, member, request ID, tool, company, outcome, amount, and pricing version. Atomically create an unlock and debit the balance; use unique workspace/company and request constraints so concurrent calls and retries charge once. Return `charged_usd`, `already_unlocked`, and `remaining_balance_usd` with paid results. Previous ledger entries retain their original prices after config changes.

## Build and verification

1. Move the web app into the workspace layout and extract shared reads without changing scan behavior.
2. Add company identity, publication rules, and public response schemas; verify no discovery-source fields cross the boundary.
3. Implement the three MCP tools and test date filters, pagination, and duplicate companies with MCP Inspector, Claude Code, and Codex.
4. Add workspace authentication, invitations, Checkout, webhook handling, balance ledger, and atomic unlocks.
5. Verify one $1 debit for the first successful profile read, free repeat reads across members and clients, no debit on failure, safe concurrent requests, and one credit for a replayed payment webhook.

The MVP is ready when a team can sign up, connect an MCP client, find this week's companies, buy $5, unlock one usable profile for $1, and share that unlocked profile without exposing Signal's discovery method.
