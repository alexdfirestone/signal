"use client";

import { useEffect, useRef, useState } from "react";

type Lead = { name: string; handle: string; company: string; category: string; website: string | null; domain: string | null; location: string | null; source: string; age: string };
type Signal = { username: string; name: string; source_username?: string; discovered_at: string; company_name?: string; summary?: string; industry?: string; website?: string | null; location?: string | null };
const views = [["week", "This week"], ["month", "This month"], ["all", "All"]] as const;
const tagColors = ["gray", "brown", "orange", "yellow", "green", "blue", "purple", "pink", "red"];

// Stable Notion-style select color per category label.
function tagColor(label: string) {
  let hash = 0;
  for (const char of label) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return `tag tag-${tagColors[Math.abs(hash) % tagColors.length]}`;
}

function SearchIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></svg>; }

function websiteLink(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (!(["http:", "https:"].includes(url.protocol)) || !url.hostname.includes(".")) return null;
    return { href: url.href, domain: url.hostname.replace(/^www\./, "") };
  } catch { return null; }
}

function toLead(signal: Signal): Lead {
  const site = websiteLink(signal.website);
  return {
    name: signal.company_name || signal.name, handle: signal.username, company: signal.summary || "Research pending", category: signal.industry || "Startup",
    website: site?.href ?? null, domain: site?.domain ?? null, location: signal.location || null,
    source: signal.source_username ? `@${signal.source_username}` : "—",
    age: new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(signal.discovered_at)),
  };
}

export default function Dashboard() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(true);
  const [view, setView] = useState<"week" | "month" | "all">("week");
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [toast, setToast] = useState("");
  const [running, setRunning] = useState(false);
  const searchInput = useRef<HTMLInputElement>(null);
  const requestKey = useRef("");
  const serverQuery = view === "all" ? query : "";
  const filteredLeads = view === "all" ? leads : leads.filter((lead) =>
    `${lead.name} ${lead.company} ${lead.category} ${lead.domain ?? ""} ${lead.location ?? ""} ${lead.source}`.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    let alive = true;
    const key = `${view}:${serverQuery}`;
    requestKey.current = key;
    setLoadingLeads(true);
    setHasMore(false);
    const url = view === "all" ? `/api/signals?period=all&q=${encodeURIComponent(serverQuery)}` : `/api/signals?period=${view}`;
    fetch(url).then(async (response) => {
      if (!response.ok) throw new Error("Could not load signals");
      const { signals, hasMore: more } = await response.json();
      if (!alive) return;
      if (Array.isArray(signals)) setLeads(signals.map(toLead));
      else setLeads([]);
      setHasMore(Boolean(more));
    }).catch(() => { if (alive) setLeads([]); }).finally(() => { if (alive) setLoadingLeads(false); });
    return () => { alive = false; };
  }, [view, serverQuery]);

  async function loadMore() {
    if (loadingMore || !hasMore) return;
    const key = requestKey.current;
    setLoadingMore(true);
    try {
      const response = await fetch(`/api/signals?period=all&offset=${leads.length}&q=${encodeURIComponent(query)}`);
      if (!response.ok) throw new Error("Could not load more startups");
      const { signals, hasMore: more } = await response.json();
      if (requestKey.current !== key) return;
      setLeads((current) => [...current, ...signals.map(toLead)]);
      setHasMore(Boolean(more));
    } catch { notify("Could not load more startups"); }
    finally { setLoadingMore(false); }
  }

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
      <div className="viewbar">
        {views.map(([value, label]) => <button key={value} className="tab" aria-pressed={view === value} onClick={() => setView(value)}>{label}</button>)}
        <div className="search">
          {(searching || query) && <input ref={searchInput} value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") { setQuery(""); setSearching(false); } }} onBlur={() => { if (!query) setSearching(false); }} placeholder="Type to search…" aria-label="Search startups"/>}
          {!searching && !query && <button className="icon-button" onClick={() => setSearching(true)} aria-label="Search"><SearchIcon/></button>}
        </div>
      </div>
      <table className="db">
        <thead><tr><th className="col-name">Name</th><th>About</th><th className="col-website">Website</th><th className="col-tag hide-sm">Category</th><th className="col-location hide-sm">Location</th><th className="col-source hide-sm">Followed by</th><th className="col-date hide-sm">Found</th></tr></thead>
        <tbody>{loadingLeads ? Array.from({ length: 4 }, (_, index) => <tr key={`skeleton-${index}`} className="skeleton-row" aria-hidden="true">
          <td><span className="skeleton-block skeleton-name"/></td>
          <td><span className="skeleton-block skeleton-about"/></td>
          <td><span className="skeleton-block skeleton-website"/></td>
          <td className="hide-sm"><span className="skeleton-block skeleton-category"/></td>
          <td className="hide-sm"><span className="skeleton-block skeleton-location"/></td>
          <td className="hide-sm"><span className="skeleton-block skeleton-source"/></td>
          <td className="hide-sm"><span className="skeleton-block skeleton-date"/></td>
        </tr>) : filteredLeads.map((lead) => <tr key={`${lead.handle}-${lead.source}`}>
          <td><a className="row-title" href={`https://x.com/${lead.handle}`} target="_blank" rel="noreferrer" title={`@${lead.handle}`}>{lead.name}</a></td>
          <td className="quiet" title={lead.company}>{lead.company}</td>
          <td>{lead.website ? <a className="row-title" href={lead.website} target="_blank" rel="noopener noreferrer" title={lead.website}>{lead.domain}</a> : <span className="quiet">—</span>}</td>
          <td className="hide-sm"><span className={tagColor(lead.category)}>{lead.category}</span></td>
          <td className="hide-sm quiet" title={lead.location ?? ""}>{lead.location ?? "—"}</td>
          <td className="hide-sm">{lead.source}</td>
          <td className="hide-sm quiet">{lead.age}</td>
        </tr>)}</tbody>
      </table>
      {!loadingLeads && !filteredLeads.length && <div className="empty">{query ? "No matches found." : view === "week" ? "No new startups found this week." : view === "month" ? "No new startups found this month." : "No startups found yet."}</div>}
      {view === "all" && !loadingLeads && hasMore && <button className="load-more" onClick={() => void loadMore()} disabled={loadingMore}>{loadingMore ? "Loading more…" : "Load more"}</button>}
    </div>
    {toast && <div className="toast" role="status">{toast}</div>}
  </main>;
}
