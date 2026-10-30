// Terminal sessions as the island shows them, fed by Claude Code hook events.
// Pure: a Map session_id -> { id, cwd, state, text, tool?, last?, at } goes in, a new one comes out (the same one when nothing changed).
// last: Claude's latest answer (Stop's last_assistant_message); it stays through the next turn until a new one comes.
import { QUIET, hookToStatus } from './status.js';

export const STALE_MS = 30 * 60 * 1000; // no event for 30 min: the terminal was probably closed without SessionEnd
export const DONE_MS = 2 * 60 * 1000; // "fertig" owns the island this long, then the session goes quiet (M4)

// changed: the session's new state when it differs from before, so there is one chime/toast per prompt, not per event.
export function onHook(sessions, e, now) {
  const id = e?.session_id != null ? String(e.session_id) : '';
  if (!id) return { sessions };
  const prev = sessions.get(id);
  if (e.hook_event_name === 'SessionEnd') {
    if (!prev) return { sessions };
    const next = new Map(sessions);
    next.delete(id);
    return { sessions: next };
  }
  const s = hookToStatus(e, prev);
  if (!s) return { sessions };
  const answer = e.hook_event_name === 'Stop' && typeof e.last_assistant_message === 'string' && e.last_assistant_message.trim();
  const last = answer ? e.last_assistant_message : prev?.last;
  const next = new Map(sessions);
  next.set(id, { ...s, id, cwd: String(e.cwd ?? ''), at: now, ...(last && { last }) });
  return { sessions: sweep(next, now), changed: s.state !== prev?.state ? s.state : undefined };
}

// Runs every minute too, so a closed terminal or an old "fertig" goes away without waiting for the next event.
export function sweep(sessions, now) {
  let next = sessions;
  for (const [id, t] of sessions) {
    const stale = now - t.at > STALE_MS;
    if (!stale && !(t.state === 'done' && now - t.at > DONE_MS)) continue;
    if (next === sessions) next = new Map(sessions);
    if (stale) next.delete(id);
    else next.set(id, { ...t, ...QUIET }); // `at` stays: staleness still counts from the last event
  }
  return next;
}
