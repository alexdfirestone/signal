export function dateTime(value: unknown) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Los_Angeles" }).format(new Date(String(value)));
}

export function day(value: unknown) {
  const literal = String(value).slice(0, 10);
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${literal}T12:00:00Z`));
}

export function count(value: unknown) { return Number(value ?? 0).toLocaleString("en-US"); }

export function statusLabel(value: unknown) {
  return String(value).replaceAll("_", " ");
}

export function isStalled(status: unknown, startedAt: unknown) {
  return (status === "queued" || status === "running") &&
    Date.now() - new Date(String(startedAt)).getTime() > 2 * 60 * 60 * 1000;
}

export function runStatus(status: unknown, startedAt: unknown) {
  return isStalled(status, startedAt) ? "stalled" : statusLabel(status);
}
