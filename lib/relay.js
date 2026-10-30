// Permission requests from terminal sessions that wait for an answer from the island (hook.cjs --wait).
// Claude Code does not end a waiting hook when the user answers in the terminal (#15433), so a later event of the
// same session settles the request with null: the hook then exits silently and the island drops the card.

// A turn moved on: whatever the card asked is decided.
const ENDS_TURN = new Set(['Stop', 'UserPromptSubmit', 'SessionEnd']);
// Async PostToolUse of an earlier tool can land after a new request (M1), so only the asked tool counts, after a grace.
const GRACE_MS = 800;

export function createRelay({ now = Date.now } = {}) {
  const pending = new Map(); // id → { id, sessionId, tool, at, resolve }
  let seq = 0;

  const settle = (id, reply) => {
    const p = pending.get(id);
    if (!p) return false;
    pending.delete(id);
    p.resolve(reply);
    return true;
  };
  const settleWhere = (match) => [...pending.values()].filter(match).map((p) => (settle(p.id, null), p.id));

  return {
    // event: the slimmed hook event; resolve(reply | null) answers the waiting HTTP request.
    // Returns the new id and the ids of older requests it replaced (one open card per session).
    wait(event, resolve) {
      const sessionId = event?.session_id ?? null;
      const replaced = sessionId ? settleWhere((p) => p.sessionId === sessionId) : [];
      const id = `r${++seq}`;
      pending.set(id, { id, sessionId, tool: event?.tool_name ?? null, at: now(), resolve });
      return { id, replaced };
    },
    answer: (id, reply) => settle(id, reply),
    // Any observed event; returns the ids it settled so the island can drop those cards.
    onEvent(event) {
      const sid = event?.session_id;
      if (!sid) return [];
      const name = event.hook_event_name;
      if (ENDS_TURN.has(name)) return settleWhere((p) => p.sessionId === sid);
      if (name === 'PostToolUse' || name === 'PostToolUseFailure')
        return settleWhere((p) => p.sessionId === sid && p.tool === event.tool_name && now() - p.at >= GRACE_MS);
      return [];
    },
    // App quits or the relay is switched off: every hook falls back to its terminal dialog.
    cancelAll: () => settleWhere(() => true),
    get size() {
      return pending.size;
    },
  };
}
