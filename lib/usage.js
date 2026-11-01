// Claude's plan limits as the Home tile shows them, from the CLI's own /usage data.
const WARN_AT = 90; // percent: once per window a toast says the limit is near

const row = (w) => (Number.isFinite(w?.utilization) ? { percent: Math.round(w.utilization), resets: w.resets_at ?? null } : null);

// null: no plan limits here (API key, not logged in, or the experimental call changed)
export function toUsage(limits) {
  const session = row(limits?.five_hour);
  const week = row(limits?.seven_day);
  return session || week ? { session, week } : null;
}

// Toasts due now. seen (a Set) remembers them per window, so a new window warns again. resets_at varies below the minute.
export function limitWarnings(usage, seen) {
  const out = [];
  for (const [name, w] of [['5-Stunden-Limit', usage?.session], ['Wochenlimit', usage?.week]]) {
    if (!w || w.percent < WARN_AT) continue;
    const key = `${name}:${String(w.resets).slice(0, 16)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(`${name} bei ${w.percent} %.`);
  }
  return out;
}
