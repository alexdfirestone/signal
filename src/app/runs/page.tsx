import { ensureSchema, getSql } from "@/lib/db";
import { count, dateTime } from "@/lib/scan-view";

export const dynamic = "force-dynamic";

export default async function RunsPage() {
  let runs: Record<string, unknown>[] = [];
  let error = "";
  try {
    await ensureSchema();
    runs = await getSql()`SELECT s.*, count(a.id)::integer AS account_runs,
      coalesce(sum(a.new_follows), 0)::integer AS new_follows,
      coalesce(sum(a.startups), 0)::integer AS startups,
      count(a.id) FILTER (WHERE a.status = 'failed' OR a.status = 'partial' OR (a.status IN ('queued', 'running') AND a.started_at < now() - interval '2 hours'))::integer AS failures,
      count(a.id) FILTER (WHERE a.status IN ('queued', 'running') AND a.started_at >= now() - interval '2 hours')::integer AS active
      FROM scan_runs s LEFT JOIN account_scan_runs a ON a.scan_run_id = s.id
      GROUP BY s.id ORDER BY s.started_at DESC LIMIT 100`;
  } catch (cause) { error = cause instanceof Error ? cause.message : "Could not load scan runs"; }
  return <main><header className="topbar"><nav className="crumbs"><a className="ghost" href="/">Signal</a><span>/</span><a className="ghost" href="/runs">Runs</a></nav><a className="ghost muted" href="/accounts">Accounts</a></header>
    <div className="content"><h1>Scan runs</h1><p className="lede">Daily history of followed people and qualified startups. Times are Pacific.</p>
      {error && <div className="callout error" role="alert">{error}</div>}
      <div className="table-scroll"><table className="db"><thead><tr><th>Started</th><th>Source</th><th>Status</th><th className="num">Accounts</th><th className="num">New follows</th><th className="num">Startups</th><th className="num">Issues</th></tr></thead><tbody>
        {runs.map((run) => <tr key={String(run.id)}><td><a className="row-title" href={`/runs/${run.id}`}>{dateTime(run.started_at)}</a></td><td>{String(run.trigger)}</td><td>{Number(run.active) ? "running" : Number(run.failures) ? "needs attention" : run.status === "failed" ? "failed" : "complete"}</td><td className="num">{count(run.account_runs)}</td><td className="num">{count(run.new_follows)}</td><td className="num">{count(run.startups)}</td><td className="num">{count(run.failures)}</td></tr>)}
      </tbody></table></div>{!runs.length && !error && <div className="empty">No scan runs yet.</div>}
    </div></main>;
}
