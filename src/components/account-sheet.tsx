"use client";

import { useState } from "react";

export type AccountCategory = "investor" | "influencer" | "executive" | "person";
export type TrackedAccount = { id: string; username: string; name: string; category: AccountCategory; last_checked_at?: string | null };

const categories: { value: AccountCategory; label: string; detail: string }[] = [
  { value: "investor", label: "Investor", detail: "VCs, angels, and fund partners" },
  { value: "influencer", label: "Influencer", detail: "People who shape a market or community" },
  { value: "executive", label: "Executive", detail: "Founders and company leaders" },
  { value: "person", label: "Person", detail: "Any other account, including your own" },
];

export default function AccountSheet({ onClose, onAdded }: { onClose: () => void; onAdded: (account: TrackedAccount) => void }) {
  const [username, setUsername] = useState("");
  const [category, setCategory] = useState<AccountCategory>("investor");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/tracked-accounts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim().replace(/^@/, ""), category }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not add this account");
      onAdded(result.account as TrackedAccount);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Could not add this account";
      setError(message.includes("DATABASE_URL") ? "Connect Neon before adding tracked accounts." : message.includes("X_BEARER_TOKEN") ? "Add your X API bearer token before verifying accounts." : message);
    } finally { setSaving(false); }
  }

  return <div className="sheet-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <aside className="account-sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
      <div className="sheet-head"><div><div className="sheet-kicker">TRACK A PUBLIC X ACCOUNT</div><h2 id="sheet-title">Add account</h2></div><button className="sheet-close" onClick={onClose} aria-label="Close">×</button></div>
      <p className="sheet-intro">We’ll save the current follow list as a baseline. Future scans only surface accounts newly followed after that.</p>
      <form onSubmit={submit}>
        <label className="sheet-label" htmlFor="new-x-account">X username</label>
        <div className="sheet-username"><span>@</span><input id="new-x-account" autoFocus value={username} onChange={(event) => setUsername(event.target.value)} placeholder="username" required maxLength={16}/></div>
        <div className="sheet-label category-label">Account type</div>
        <div className="category-options">{categories.map((option) => <label key={option.value} className={category === option.value ? "category-option checked" : "category-option"}>
          <input type="radio" name="account-category" value={option.value} checked={category === option.value} onChange={() => setCategory(option.value)}/>
          <span className="category-option-copy"><b>{option.label}</b><small>{option.detail}</small></span><span className="radio-dot"/>
        </label>)}</div>
        {error && <div className="sheet-error" role="alert">{error}</div>}
        <div className="sheet-foot"><span>Up to 10 tracked accounts</span><div><button type="button" className="cancel-button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={saving}>{saving ? "Adding…" : "Add account"}</button></div></div>
      </form>
    </aside>
  </div>;
}
