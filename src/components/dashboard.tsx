"use client";

import { useEffect, useMemo, useState } from "react";
import AccountSheet, { type TrackedAccount } from "@/components/account-sheet";

type Profile = { initials: string; name: string; handle: string; checked: string };
type Lead = { name: string; handle: string; company: string; category: string; confidence: number; source: string; age: string };
type Period = "today" | "week" | "month";

const demoProfiles: Profile[] = [
  { initials: "SG", name: "Sarah Guo", handle: "saranormous", checked: "2h ago" },
  { initials: "AL", name: "Aileen Lee", handle: "aileenlee", checked: "2h ago" },
  { initials: "NR", name: "Naval Ravikant", handle: "naval", checked: "3h ago" },
  { initials: "MH", name: "Mitch Harper", handle: "mitchharper", checked: "3h ago" },
];

const demoLeads: Lead[] = [
  { name: "Nooks", handle: "nooks.ai", company: "AI sales workspace helping revenue teams prospect, dial, and close.", category: "AI / SaaS", confidence: 96, source: "Sarah Guo", age: "2h ago" },
  { name: "Parallel", handle: "parallelhq", company: "An AI-native browser that automates repetitive knowledge work.", category: "AI / Productivity", confidence: 91, source: "Aileen Lee", age: "5h ago" },
  { name: "Runway", handle: "runwayml", company: "Applied AI research for art, entertainment, and human creativity.", category: "AI / Creative", confidence: 88, source: "Naval Ravikant", age: "Yesterday" },
  { name: "Daylight", handle: "daylightco", company: "Consumer fintech making financial planning more human.", category: "Fintech", confidence: 82, source: "Sarah Guo", age: "Yesterday" },
];

function Plus() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>; }

export default function Dashboard() {
  const [profiles, setProfiles] = useState(demoProfiles);
  const [leads, setLeads] = useState(demoLeads);
  const [connected, setConnected] = useState(false);
  const [dateLabel, setDateLabel] = useState("today");
  const [period, setPeriod] = useState<Period>("today");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState("");
  const [running, setRunning] = useState(false);
  const filteredLeads = useMemo(() => leads.filter((lead) => {
    const withinPeriod = connected || period !== "today" || !lead.age.toLowerCase().includes("yesterday");
    return withinPeriod && `${lead.name} ${lead.company} ${lead.category} ${lead.source}`.toLowerCase().includes(query.toLowerCase());
  }), [leads, query, period, connected]);

  useEffect(() => {
    let alive = true;
    setDateLabel(new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric" }).format(new Date()));
    fetch("/api/tracked-accounts").then(async (accountsResponse) => {
      if (!accountsResponse.ok) return;
      const { accounts } = await accountsResponse.json();
      if (!alive) return;
      setConnected(true);
      if (Array.isArray(accounts)) setProfiles(accounts.map((account: { username: string; name: string; last_checked_at?: string }) => ({
        initials: account.name.split(/\s+/).map((part: string) => part[0]).join("").slice(0, 2), name: account.name, handle: account.username,
        checked: account.last_checked_at ? new Date(account.last_checked_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "Not checked yet",
      })));
    }).catch(() => undefined);
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    fetch(`/api/signals?period=${period}`).then(async (response) => {
      if (!response.ok) return;
      const { signals } = await response.json();
      if (!alive) return;
      setConnected(true);
      if (Array.isArray(signals)) setLeads(signals.map((signal: { username: string; name: string; source_username?: string; discovered_at: string; company_name?: string; summary?: string; industry?: string; confidence?: number }) => ({
        name: signal.company_name || signal.name, handle: signal.username, company: signal.summary || "Research pending", category: signal.industry || "Startup",
        confidence: signal.confidence ?? 0, source: signal.source_username || "Investor", age: new Date(signal.discovered_at).toLocaleDateString(),
      })));
    }).catch(() => undefined);
    return () => { alive = false; };
  }, [period]);

  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(""), 3000); };

  function accountAdded(account: TrackedAccount) {
    setProfiles((current) => [{ initials: account.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2), name: account.name, handle: account.username, checked: "Just now" }, ...current]);
    setConnected(true); setSheetOpen(false); notify(`@${account.username} added`);
  }

  async function runScan() {
    setRunning(true);
    try {
      const response = await fetch("/api/scan", { method: "POST" });
      const result = await response.json();
      notify(response.ok ? `Scan queued for ${result.queued} accounts` : "Add your Neon, X, and OpenAI keys to scan");
    } catch { notify("Add your Neon, X, and OpenAI keys to scan"); }
    finally { setRunning(false); }
  }

  return <main className="simple-page">
    <header className="simple-top"><a className="simple-brand" href="/">signal<span>.</span></a><div className="simple-top-actions"><span className="simple-status"><i className={connected ? "status-live" : "status-demo"}/>{connected ? "Live" : "Preview"}</span><a className="accounts-link" href="/accounts">Tracked accounts</a><button className="simple-add" onClick={() => setSheetOpen(true)}><Plus/> Add account</button></div></header>
    <div className="simple-content">
      <div className="simple-date">{dateLabel}</div>
      <div className="simple-title-row"><div><h1>New startups</h1><p>Recently followed by the {profiles.length} investors you track.</p></div><button className="simple-button" onClick={runScan} disabled={running}>{running ? "Scanning…" : "Scan now"}</button></div>
      <section className="simple-section signals-simple" id="signals">
        <div className="simple-section-head"><div className="period-tabs" role="group" aria-label="Filter discoveries by date">{([ ["today", "Today"], ["week", "This week"], ["month", "This month"] ] as const).map(([value, label]) => <button key={value} className={period === value ? "period-tab selected" : "period-tab"} onClick={() => setPeriod(value)}>{label}</button>)}</div><span className="result-count">{filteredLeads.length}</span><label className="simple-search"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search startups" aria-label="Search startups"/></label></div>
        {filteredLeads.length ? <div className="company-list">{filteredLeads.map((lead) => <article className="company-row" key={`${lead.handle}-${lead.source}`}><div className="company-row-main"><div className="company-row-title"><a href={`https://x.com/${lead.handle}`} target="_blank" rel="noreferrer">{lead.name}</a><span>@{lead.handle}</span><span className="simple-category">{lead.category}</span></div><p>{lead.company}</p><small>Followed by <b>{lead.source}</b> · {lead.age}</small></div><span className="simple-confidence">{lead.confidence}%</span></article>)}</div> : <div className="simple-empty">No startups found {period === "today" ? "today" : period === "week" ? "this week" : "this month"}. Check back after the next scan.</div>}
      </section>
      <footer className="simple-footer"><span>Tracking {profiles.length} investors · daily scan at 8:00 AM PT</span><span>{connected ? "Live data" : "Sample data"}</span></footer>
    </div>
    {sheetOpen && <AccountSheet onClose={() => setSheetOpen(false)} onAdded={accountAdded}/>}
    {toast && <div className="toast">{toast}</div>}
  </main>;
}
