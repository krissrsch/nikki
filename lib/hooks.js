// Adds/removes DesktopCompanion's Claude Code hooks in a parsed ~/.claude/settings.json, leaving every other hook alone.
export const EVENTS = ['SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PermissionRequest', 'PostToolUse', 'Notification', 'Stop', 'SessionEnd'];

const ours = (h) => /desktopcompanion/i.test(h.command ?? '') && /hook\.cjs/.test(h.command ?? '');

export function withoutHooks(settings) {
  const hooks = { ...settings.hooks };
  for (const [event, groups] of Object.entries(hooks)) {
    if (!Array.isArray(groups)) continue;
    const kept = groups.map((g) => ({ ...g, hooks: (g.hooks ?? []).filter((h) => !ours(h)) })).filter((g) => g.hooks.length);
    if (kept.length) hooks[event] = kept;
    else delete hooks[event];
  }
  const { hooks: _, ...rest } = settings;
  return Object.keys(hooks).length ? { ...rest, hooks } : rest;
}

// async: the terminal session never waits for the app
export function withHooks(settings, command) {
  const clean = withoutHooks(settings);
  const hooks = { ...clean.hooks };
  for (const event of EVENTS) hooks[event] = [...(hooks[event] ?? []), { hooks: [{ type: 'command', command, async: true }] }];
  return { ...clean, hooks };
}
