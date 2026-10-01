import { notFound } from "next/navigation";
import { ensureSchema, getSql } from "@/lib/db";
import { count, dateTime, runStatus, statusLabel } from "@/lib/scan-view";

export const dynamic = "force-dynamic";

export default async function AccountRunPage({ params }: { params: Promise<{ id: string; runId: string }> }) {
  const { id, runId } = await params;
  await ensureSchema();
  const sql = getSql();
  const [run] = await sql`SELECT * FROM account_scan_runs WHERE id = ${runId} AND account_id = ${id}`;
  if (!run) notFound();
  const follows = await sql`SELECT d.id, d.username, d.name, d.research_status, d.is_company,
    d.company_name, d.summary, d.research_error
    FROM account_scan_follows f JOIN discovered_accounts d ON d.id = f.discovered_account_id
    WHERE f.account_scan_run_id = ${runId} ORDER BY d.username`;
  return <main><header className="topbar"><nav className="crumbs"><a className="ghost" href="/">Signal</a><span>/</span><a className="ghost" href="/accounts">Accounts</a><span>/</span><a className="ghost" href={`/accounts/${id}`}>@{String(run.username)}</a></nav>{run.scan_run_id && <a className="ghost muted" href={`/runs/${run.scan_run_id}`}>Full run</a>}</header>
    <div className="content"><h1>@{String(run.username)} scan</h1><p className="lede">Started {dateTime(run.started_at)} · {runStatus(run.status, run.started_at)} · {statusLabel(run.stage)} · Pacific time</p>
      {run.error && <div className="callout error" role="alert">{String(run.error)}</div>}
      <div className="metric-grid"><div className="metric"><strong>{count(run.new_follows)}</strong><span>New follows</span></div><div className="metric"><strong>{count(run.researched)}</strong><span>Researched</span></div><div className="metric"><strong>{count(run.startups)}</strong><span>Startups flagged</span></div><div className="metric"><strong>{count(run.research_failed)}</strong><span>Research failures</span></div></div>
      <h2>Newly followed profiles</h2><div className="table-scroll"><table className="db"><thead><tr><th>Profile</th><th>Research</th><th>Decision</th><th>Detail</th></tr></thead><tbody>{follows.map((follow) => <tr key={String(follow.id)}><td><a className="row-title" href={`https://x.com/${encodeURIComponent(String(follow.username))}`} target="_blank" rel="noreferrer">@{String(follow.username)}</a></td><td>{statusLabel(follow.research_status)}</td><td>{follow.is_company == null ? "Pending" : follow.is_company ? "Startup" : "Excluded"}</td><td title={String(follow.research_error ?? follow.summary ?? "")}>{String(follow.research_error ?? follow.summary ?? "—")}</td></tr>)}</tbody></table></div>
      {!follows.length && <div className="empty">No new follows recorded for this scan.</div>}
      {run.workflow_run_id && <p className="run-id">Workflow run ID: <code>{String(run.workflow_run_id)}</code></p>}
    </div></main>;
}
