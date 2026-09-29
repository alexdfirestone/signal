"use client";

import { useEffect, useState } from "react";
import AccountSheet, { type AccountCategory, type TrackedAccount } from "@/components/account-sheet";

const categoryOptions: { value: AccountCategory; label: string }[] = [
  { value: "investor", label: "Investor" }, { value: "influencer", label: "Influencer" },
  { value: "executive", label: "Executive" }, { value: "person", label: "Person" },
];

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
      setError(message.includes("DATABASE_URL") ? "Connect Neon to load your accounts. Add an X API token to register new handles." : message);
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

  return <main className="simple-page">
    <header className="simple-top"><a className="simple-brand" href="/">signal<span>.</span></a><a className="accounts-link" href="/">← New startups</a></header>
    <div className="simple-content accounts-content">
      <div className="simple-date">SETTINGS</div>
      <div className="simple-title-row"><div><h1>Tracked accounts</h1><p>Choose which public X accounts to scan and how to group them.</p></div><button className="simple-add" onClick={() => setSheetOpen(true)}>＋ Add account</button></div>
      <div className="account-count-note">{accounts.length} of 10 accounts</div>
      {error && <div className={error.startsWith("Connect Neon") ? "accounts-error setup-note" : "accounts-error"} role="alert">{error}</div>}
      <section className="managed-list" aria-label="Tracked X accounts">
        <div className="managed-header"><span>ACCOUNT</span><span>TYPE</span><span>LAST SCAN</span><span/></div>
        {loading ? <div className="managed-empty">Loading accounts…</div> : accounts.length ? accounts.map((account) => <div className="managed-row" key={account.id}>
          <div className="managed-person"><span className="person-initials">{account.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2)}</span><span><b>{account.name}</b><small>@{account.username}</small></span></div>
          <label className="visually-hidden" htmlFor={`category-${account.id}`}>Type for @{account.username}</label>
          <select id={`category-${account.id}`} value={account.category} disabled={busyId === account.id} onChange={(event) => void updateCategory(account, event.target.value as AccountCategory)}>{categoryOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
          <span className="managed-scan">{account.last_checked_at ? new Date(account.last_checked_at).toLocaleDateString() : "Not scanned"}</span>
          <button className="remove-account" onClick={() => void removeAccount(account)} disabled={busyId === account.id}>Remove</button>
        </div>) : <div className="managed-empty">No accounts yet. Add an X account to start a follow graph.</div>}
      </section>
      <p className="managed-footnote">Each new account starts with a baseline. We only flag follows added after the baseline.</p>
    </div>
    {sheetOpen && <AccountSheet onClose={() => setSheetOpen(false)} onAdded={accountAdded}/>}
  </main>;
}
