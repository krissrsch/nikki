// Adds/removes DesktopCompanion observe-hooks in ~/.cursor/hooks.json, leaving foreign hooks (e.g. ponytail) alone.
// Note: do NOT register afterAgentThought — Cursor ACP finishes the turn before that
// hook returns and then surfaces "RetriableError: WritableIterable is closed" (Cursor forum).
export const CURSOR_EVENTS = [
  'sessionStart',
  'sessionEnd',
  'beforeSubmitPrompt',
  'preToolUse',
  'postToolUse',
  'postToolUseFailure',
  'stop',
  'afterAgentResponse',
  'beforeShellExecution',
  'afterShellExecution',
];

const ours = (h) => /desktopcompanion/i.test(h.command ?? '') && /hook\.cjs/.test(h.command ?? '');

export function withoutCursorHooks(settings) {
  const hooks = { ...(settings.hooks ?? {}) };
  for (const [event, list] of Object.entries(hooks)) {
    if (!Array.isArray(list)) continue;
    const kept = list.filter((h) => !ours(h));
    if (kept.length) hooks[event] = kept;
    else delete hooks[event];
  }
  const { hooks: _, ...rest } = settings;
  return Object.keys(hooks).length ? { ...rest, hooks } : { ...rest };
}

export function withCursorHooks(settings, command) {
  const clean = withoutCursorHooks(settings);
  const hooks = { ...clean.hooks };
  for (const event of CURSOR_EVENTS) {
    const entry = { command };
    // observe-only: short timeout so a dead companion never stalls the agent
    if (event === 'preToolUse') entry.timeout = 5;
    hooks[event] = [...(hooks[event] ?? []), entry];
  }
  return { ...clean, version: clean.version ?? 1, hooks };
}
