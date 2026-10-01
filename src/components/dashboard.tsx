"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Lead = { name: string; handle: string; company: string; category: string; confidence: number; source: string; age: string };
type Period = "today" | "week" | "month";

const periods = [["today", "Today"], ["week", "This week"], ["month", "This month"]] as const;
const emptyLabel: Record<Period, string> = { today: "today", week: "this week", month: "this month" };
const tagColors = ["gray", "brown", "orange", "yellow", "green", "blue", "purple", "pink", "red"];

// Stable Notion-style select color per category label.
function tagColor(label: string) {
  let hash = 0;
  for (const char of label) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return `tag tag-${tagColors[Math.abs(hash) % tagColors.length]}`;
}

function SearchIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></svg>; }

export default function Dashboard() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(true);
  const [accountCount, setAccountCount] = useState<number | null>(null);
  const [connected, setConnected] = useState(false);
  const [period, setPeriod] = useState<Period>("today");
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [toast, setToast] = useState("");
  const [running, setRunning] = useState(false);
  const searchInput = useRef<HTMLInputElement>(null);
  const filteredLeads = useMemo(() => leads.filter((lead) => {
    const withinPeriod = connected || period !== "today" || !lead.age.toLowerCase().includes("yesterday");
    return withinPeriod && `${lead.name} ${lead.company} ${lead.category} ${lead.source}`.toLowerCase().includes(query.toLowerCase());
  }), [leads, query, period, connected]);

  useEffect(() => {
    let alive = true;
    fetch("/api/tracked-accounts").then(async (response) => {
      const { accounts } = response.ok ? await response.json() : {};
      if (!alive) return;
      if (!Array.isArray(accounts)) return setAccountCount(4);
      setConnected(true); setAccountCount(accounts.length);
    }).catch(() => { if (alive) setAccountCount(4); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    setLoadingLeads(true);
    fetch(`/api/signals?period=${period}`).then(async (response) => {
      if (!response.ok) throw new Error("Could not load signals");
      const { signals } = await response.json();
      if (!alive) return;
      setConnected(true);
      if (Array.isArray(signals)) setLeads(signals.map((signal: { username: string; name: string; source_username?: string; discovered_at: string; company_name?: string; summary?: string; industry?: string; confidence?: number }) => ({
        name: signal.company_name || signal.name, handle: signal.username, company: signal.summary || "Research pending", category: signal.industry || "Startup",
        confidence: signal.confidence ?? 0, source: signal.source_username ? `@${signal.source_username}` : "—",
        age: new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(signal.discovered_at)),
      })));
      else setLeads([]);
    }).catch(() => { if (alive) setLeads([]); }).finally(() => { if (alive) setLoadingLeads(false); });
    return () => { alive = false; };
  }, [period]);

  useEffect(() => { if (searching) searchInput.current?.focus(); }, [searching]);

  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(""), 3000); };

  async function runScan() {
    setRunning(true);
    try {
      const response = await fetch("/api/scan", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ confirmCost: true }) });
      const result = await response.json();
      notify(response.ok ? `Scan queued for ${result.queued} accounts` : result.error || "Could not start scan");
    } catch { notify("Could not start scan"); }
    finally { setRunning(false); }
  }

  return <main>
    <header className="topbar">
      <nav className="crumbs"><a className="ghost" href="/">Signal</a></nav>
      <div className="topbar-actions"><a className="ghost muted" href="/accounts">Accounts</a><a className="ghost muted" href="/runs">Runs</a><button className="ghost muted" onClick={runScan} disabled={running}>{running ? "Scanning…" : "Scan now"}</button></div>
    </header>
    <div className="content">
      <h1>New startups</h1>
      <p className="lede">{accountCount === null ? null : accountCount ? <>Newly followed by the <a href="/accounts">{accountCount} {accountCount === 1 ? "account" : "accounts"}</a> you track</> : <><a href="/accounts">Add an account</a> to start finding startups</>}{accountCount !== null && !connected && " · Sample data"}</p>
      <div className="viewbar">
        {periods.map(([value, label]) => <button key={value} className="tab" aria-pressed={period === value} onClick={() => setPeriod(value)}>{label}</button>)}
        <div className="search">
          {(searching || query) && <input ref={searchInput} value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") { setQuery(""); setSearching(false); } }} onBlur={() => { if (!query) setSearching(false); }} placeholder="Type to search…" aria-label="Search startups"/>}
          {!searching && !query && <button className="icon-button" onClick={() => setSearching(true)} aria-label="Search"><SearchIcon/></button>}
        </div>
      </div>
      <table className="db">
        <thead><tr><th className="col-name">Name</th><th>About</th><th className="col-tag hide-sm">Category</th><th className="col-source hide-sm">Followed by</th><th className="col-date hide-sm">Found</th><th className="col-num num">Confidence</th></tr></thead>
        <tbody>{loadingLeads ? Array.from({ length: 4 }, (_, index) => <tr key={`skeleton-${index}`} className="skeleton-row" aria-hidden="true">
          <td><span className="skeleton-block skeleton-name"/></td>
          <td><span className="skeleton-block skeleton-about"/></td>
          <td className="hide-sm"><span className="skeleton-block skeleton-category"/></td>
          <td className="hide-sm"><span className="skeleton-block skeleton-source"/></td>
          <td className="hide-sm"><span className="skeleton-block skeleton-date"/></td>
          <td className="num"><span className="skeleton-block skeleton-confidence"/></td>
        </tr>) : filteredLeads.map((lead) => <tr key={`${lead.handle}-${lead.source}`}>
          <td><a className="row-title" href={`https://x.com/${lead.handle}`} target="_blank" rel="noreferrer" title={`@${lead.handle}`}>{lead.name}</a></td>
          <td className="quiet" title={lead.company}>{lead.company}</td>
          <td className="hide-sm"><span className={tagColor(lead.category)}>{lead.category}</span></td>
          <td className="hide-sm">{lead.source}</td>
          <td className="hide-sm quiet">{lead.age}</td>
          <td className="num quiet">{lead.confidence}%</td>
        </tr>)}</tbody>
      </table>
      {!loadingLeads && !filteredLeads.length && <div className="empty">{query ? "No matches." : `No new startups ${emptyLabel[period]}.`}</div>}
    </div>
    {toast && <div className="toast" role="status">{toast}</div>}
  </main>;
}
