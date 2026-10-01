"use client";

import { useEffect, useState } from "react";
import AccountSheet, { categories, type AccountCategory, type TrackedAccount } from "@/components/account-sheet";

function initials(name: string) { return name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase(); }
function Plus() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>; }
function Trash() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg>; }

export default function TrackedAccounts() {
  const [accounts, setAccounts] = useState<TrackedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  async function refresh() {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/tracked-accounts");
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not load tracked accounts");
      setAccounts(result.accounts as TrackedAccount[]);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Could not load tracked accounts";
      setError(message.includes("DATABASE_URL") ? "Connect Neon to load your accounts." : message);
    }
    finally { setLoading(false); }
  }

  useEffect(() => { void refresh(); }, []);

  async function updateCategory(account: TrackedAccount, category: AccountCategory) {
    setBusyId(account.id); setError("");
    try {
      const response = await fetch(`/api/tracked-accounts/${encodeURIComponent(account.id)}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ category }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not update account");
      setAccounts((current) => current.map((item) => item.id === account.id ? { ...item, category } : item));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not update account"); }
    finally { setBusyId(""); }
  }

  async function removeAccount(account: TrackedAccount) {
    if (!window.confirm(`Stop tracking @${account.username}?`)) return;
    setBusyId(account.id); setError("");
    try {
      const response = await fetch(`/api/tracked-accounts/${encodeURIComponent(account.id)}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not remove account");
      setAccounts((current) => current.filter((item) => item.id !== account.id));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not remove account"); }
    finally { setBusyId(""); }
  }

  function accountAdded(account: TrackedAccount) { setAccounts((current) => [account, ...current]); setSheetOpen(false); }

  return <main>
    <header className="topbar"><nav className="crumbs"><a className="ghost" href="/">Signal</a><span>/</span><a className="ghost" href="/accounts">Accounts</a></nav><a className="ghost muted" href="/runs">Runs</a></header>
    <div className="content">
      <h1>Tracked accounts</h1>
      <p className="lede">Signal checks who these accounts follow every day · {accounts.length} tracked</p>
      {error && <div className="callout" role="alert">{error}</div>}
      <table className="db" aria-label="Tracked X accounts">
        <thead><tr><th>Name</th><th className="col-following num">Followers</th><th className="col-type">Type</th><th className="col-scan hide-sm">Last scan</th><th className="col-action"><span className="visually-hidden">Actions</span></th></tr></thead>
        <tbody>{accounts.map((account) => {
          const color = categories.find((option) => option.value === account.category)?.color ?? "gray";
          return <tr key={account.id}>
            <td><span className="person"><span className="avatar" aria-hidden>{initials(account.name)}</span><span><a className="row-title" href={`/accounts/${encodeURIComponent(account.id)}`}>{account.name}</a> <span className="handle">@{account.username}</span></span></span></td>
            <td className="num quiet">{account.followers_count == null ? "—" : Number(account.followers_count).toLocaleString("en-US")}</td>
            <td><select className={`tag tag-${color}`} value={account.category} disabled={busyId === account.id} aria-label={`Type for @${account.username}`} onChange={(event) => void updateCategory(account, event.target.value as AccountCategory)}>{categories.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></td>
            <td className="hide-sm quiet">{account.last_checked_at ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(account.last_checked_at)) : "—"}</td>
            <td className="num"><button className="icon-button row-action" onClick={() => void removeAccount(account)} disabled={busyId === account.id} aria-label={`Stop tracking @${account.username}`} title="Stop tracking"><Trash/></button></td>
          </tr>;
        })}</tbody>
      </table>
      {loading ? <div className="empty">Loading…</div> : <button className="new-row" onClick={() => setSheetOpen(true)}><Plus/>New</button>}
    </div>
    {sheetOpen && <AccountSheet onClose={() => setSheetOpen(false)} onAdded={accountAdded}/>}
  </main>;
}
