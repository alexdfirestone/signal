"use client";

import { useEffect, useState } from "react";

export type AccountCategory = "investor" | "influencer" | "executive" | "person";
export type TrackedAccount = { id: string; username: string; name: string; category: AccountCategory; followers_count?: number | string | null; following_count?: number | string | null; last_checked_at?: string | null };

export const categories: { value: AccountCategory; label: string; color: string }[] = [
  { value: "investor", label: "Investor", color: "green" },
  { value: "influencer", label: "Influencer", color: "purple" },
  { value: "executive", label: "Executive", color: "blue" },
  { value: "person", label: "Person", color: "gray" },
];

export default function AccountSheet({ onClose, onAdded }: { onClose: () => void; onAdded: (account: TrackedAccount) => void }) {
  const [username, setUsername] = useState("");
  const [category, setCategory] = useState<AccountCategory>("investor");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true); setError("");
    try {
      let response = await fetch("/api/tracked-accounts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim().replace(/^@/, ""), category }),
      });
      let result = await response.json();
      if (response.ok && result.needsConfirmation) {
        const cost = Number(result.estimatedMaxCostUsd).toFixed(4);
        if (!window.confirm(`Tracking @${result.account.username} may cost up to $${cost} in twitterapi.io credits. Continue?`)) return;
        response = await fetch("/api/tracked-accounts", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: username.trim().replace(/^@/, ""), category, confirmCost: true }),
        });
        result = await response.json();
      }
      if (!response.ok) throw new Error(result.error || "Could not add this account");
      onAdded(result.account as TrackedAccount);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Could not add this account";
      setError(message.includes("DATABASE_URL") ? "Connect Neon before adding tracked accounts." : message.includes("TWITTERAPI_IO_API_KEY") ? "Add your twitterapi.io API key before adding accounts." : message);
    } finally { setSaving(false); }
  }

  return <div className="overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <form className="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title" onSubmit={submit}>
      <h2 id="dialog-title">Track an X account</h2>
      <p>After you add an account, Signal syncs its 30 most recent followings in the background, then checks for new ones each day.</p>
      <label className="field"><span aria-hidden>@</span><input autoFocus value={username} onChange={(event) => setUsername(event.target.value)} placeholder="username" aria-label="X username" required maxLength={16} autoComplete="off" spellCheck={false}/></label>
      <fieldset className="choices"><legend>Type</legend>{categories.map((option) => <label key={option.value} className={`tag tag-${option.color} choice`}>
        <input type="radio" name="account-category" value={option.value} checked={category === option.value} onChange={() => setCategory(option.value)}/>{option.label}
      </label>)}</fieldset>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="dialog-actions"><button type="button" className="ghost muted" onClick={onClose}>Cancel</button><button className="primary" disabled={saving || !username.trim()}>{saving ? "Adding…" : "Add"}</button></div>
    </form>
  </div>;
}
