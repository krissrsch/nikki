// Adds/removes Nikki's Claude Code hooks in a parsed ~/.claude/settings.json, leaving every other hook,
// empty group and the key order alone (so switching off gives back the file as it was).
export const EVENTS = ['SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PermissionRequest', 'PostToolUse', 'Notification', 'Stop', 'SessionEnd'];

// Fixed marker in every command we write; the old path check still finds hooks written before 1.1.
export const MARK = '--nikki-hook';
const ours = (h) => {
  const cmd = String(h?.command ?? '');
  return cmd.includes(MARK) || (/desktopcompanion/i.test(cmd) && /hook\.cjs/.test(cmd));
};

// Drops our hooks; a group or event goes only if our filtering emptied it.
function strip(hooks) {
  const out = {};
  for (const [event, groups] of Object.entries(hooks)) {
    if (!Array.isArray(groups)) {
      out[event] = groups;
      continue;
    }
    const kept = groups.flatMap((g) => {
      const all = g?.hooks ?? [];
      const own = all.filter((h) => !ours(h));
      return own.length === all.length ? [g] : own.length ? [{ ...g, hooks: own }] : [];
    });
    if (kept.length || !groups.length) out[event] = kept;
  }
  return out;
}

// Our command as written into settings.json, or null when none of our hooks is in there.
export const hookCommandIn = (settings) =>
  Object.values(settings?.hooks ?? {})
    .flat()
    .flatMap((g) => g?.hooks ?? [])
    .find(ours)?.command ?? null;

export function withoutHooks(settings) {
  if (!settings.hooks || typeof settings.hooks !== 'object') return settings;
  const hooks = strip(settings.hooks);
  if (Object.keys(hooks).length || !Object.keys(settings.hooks).length) return { ...settings, hooks };
  const { hooks: _, ...rest } = settings;
  return rest;
}

// async: the terminal session never waits for the app
export function withHooks(settings, command) {
  const hooks = strip(settings.hooks ?? {});
  for (const event of EVENTS) hooks[event] = [...(hooks[event] ?? []), { hooks: [{ type: 'command', command: `${command} ${MARK}`, async: true }] }];
  return { ...settings, hooks };
}
