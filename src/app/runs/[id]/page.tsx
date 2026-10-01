import { notFound } from "next/navigation";
import { ensureSchema, getSql } from "@/lib/db";
import { count, dateTime, isStalled, runStatus, statusLabel } from "@/lib/scan-view";

export const dynamic = "force-dynamic";

export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await ensureSchema();
  const sql = getSql();
  const [run] = await sql`SELECT * FROM scan_runs WHERE id = ${id}`;
  if (!run) notFound();
  const accounts = await sql`SELECT * FROM account_scan_runs WHERE scan_run_id = ${id} ORDER BY started_at, username`;
  const total = (field: string) => accounts.reduce((n, account) => n + Number(account[field] ?? 0), 0);
  const active = accounts.some((account) => (account.status === "queued" || account.status === "running") && !isStalled(account.status, account.started_at));
  const issues = accounts.filter((account) => account.status === "failed" || account.status === "partial" || isStalled(account.status, account.started_at));
  return <main><header className="topbar"><nav className="crumbs"><a className="ghost" href="/">Signal</a><span>/</span><a className="ghost" href="/runs">Runs</a><span>/</span><span className="ghost">{dateTime(run.started_at)}</span></nav></header>
    <div className="content"><h1>{run.trigger === "cron" ? "Daily scan" : "Manual scan"}</h1><p className="lede">Started {dateTime(run.started_at)} · {active ? "Running" : issues.length ? "Needs attention" : run.status === "failed" ? "Failed" : "Complete"} · Pacific time</p>
      {run.error && <div className="callout error" role="alert">{String(run.error)}</div>}
      <div className="metric-grid"><div className="metric"><strong>{count(total("new_follows"))}</strong><span>New follows</span></div><div className="metric"><strong>{count(total("startups"))}</strong><span>Startups flagged</span></div><div className="metric"><strong>{count(total("research_failed"))}</strong><span>Research failures</span></div><div className="metric"><strong>{count(issues.length)}</strong><span>Account issues</span></div></div>
      <h2>Accounts</h2><div className="table-scroll"><table className="db"><thead><tr><th>Account</th><th>Status</th><th>Stage</th><th className="num">New follows</th><th className="num">Researched</th><th className="num">Startups</th><th className="num">Failed</th></tr></thead><tbody>{accounts.map((account) => <tr key={String(account.id)}><td><a className="row-title" href={`/accounts/${encodeURIComponent(String(account.account_id))}/runs/${account.id}`}>@{String(account.username)}</a></td><td>{runStatus(account.status, account.started_at)}</td><td>{statusLabel(account.stage)}</td><td className="num">{count(account.new_follows)}</td><td className="num">{count(account.researched)}</td><td className="num">{count(account.startups)}</td><td className="num">{count(account.research_failed)}</td></tr>)}</tbody></table></div>
      {!accounts.length && <div className="empty">No accounts were queued for this run.</div>}
      {issues.map((account) => account.error && <div className="callout error" key={String(account.id)}>@{String(account.username)} · {statusLabel(account.stage)}: {String(account.error)}</div>)}
      {issues.map((account) => isStalled(account.status, account.started_at) && <div className="callout error" key={`${account.id}-stalled`}>@{String(account.username)} has remained in {statusLabel(account.stage)} for over two hours. Check workflow logs using its run ID.</div>)}
    </div></main>;
}
