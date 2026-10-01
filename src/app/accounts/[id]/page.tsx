import { notFound } from "next/navigation";
import { ensureSchema, getSql } from "@/lib/db";
import { count, dateTime, day, runStatus, statusLabel } from "@/lib/scan-view";

export const dynamic = "force-dynamic";

export default async function AccountPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await ensureSchema();
  const sql = getSql();
  const [account] = await sql`SELECT id, username, name FROM tracked_accounts WHERE id = ${id}`;
  if (!account) notFound();
  const runs = await sql`SELECT * FROM account_scan_runs WHERE account_id = ${id} ORDER BY started_at DESC LIMIT 100`;
  const daily = await sql`SELECT (started_at AT TIME ZONE 'America/Los_Angeles')::date AS day,
    count(*)::integer AS runs, sum(new_follows)::integer AS new_follows,
    sum(startups)::integer AS startups, sum(research_failed)::integer AS research_failed
    FROM account_scan_runs WHERE account_id = ${id} GROUP BY 1 ORDER BY 1 DESC LIMIT 30`;
  return <main><header className="topbar"><nav className="crumbs"><a className="ghost" href="/">Signal</a><span>/</span><a className="ghost" href="/accounts">Accounts</a><span>/</span><span className="ghost">@{String(account.username)}</span></nav><a className="ghost muted" href="/runs">Runs</a></header>
    <div className="content"><h1>{String(account.name)}</h1><p className="lede">@{String(account.username)} · Day over day scan history. Dates are Pacific.</p>
      <h2>Daily totals</h2><div className="table-scroll"><table className="db"><thead><tr><th>Day</th><th className="num">Runs</th><th className="num">New follows</th><th className="num">Startups flagged</th><th className="num">Research failures</th></tr></thead><tbody>{daily.map((row) => <tr key={String(row.day)}><td>{day(row.day)}</td><td className="num">{count(row.runs)}</td><td className="num">{count(row.new_follows)}</td><td className="num">{count(row.startups)}</td><td className="num">{count(row.research_failed)}</td></tr>)}</tbody></table></div>
      {!daily.length && <div className="empty">No scans yet.</div>}
      <h2>Scan history</h2><div className="table-scroll"><table className="db"><thead><tr><th>Started</th><th>Status</th><th>Stage</th><th className="num">New follows</th><th className="num">Startups</th><th className="num">Failed</th></tr></thead><tbody>{runs.map((run) => <tr key={String(run.id)}><td><a className="row-title" href={`/accounts/${id}/runs/${run.id}`}>{dateTime(run.started_at)}</a></td><td>{runStatus(run.status, run.started_at)}</td><td>{statusLabel(run.stage)}</td><td className="num">{count(run.new_follows)}</td><td className="num">{count(run.startups)}</td><td className="num">{count(run.research_failed)}</td></tr>)}</tbody></table></div>
    </div></main>;
}
