// Migration only (Nikki 1.0 → 1.1): Cursor support is gone, but users who had it on still carry our
// observe-hooks in ~/.cursor/hooks.json. This takes them out, leaving foreign hooks (e.g. ponytail) alone.
const ours = (h) => /desktopcompanion/i.test(h.command ?? '') && /hook\.cjs/.test(h.command ?? '');

export function withoutCursorHooks(settings) {
  if (!settings.hooks) return settings;
  const hooks = {};
  for (const [event, list] of Object.entries(settings.hooks)) {
    const kept = Array.isArray(list) ? list.filter((h) => !ours(h)) : list;
    if (!Array.isArray(list) || kept.length || !list.length) hooks[event] = kept;
  }
  if (Object.keys(hooks).length || !Object.keys(settings.hooks).length) return { ...settings, hooks };
  const { hooks: _, ...rest } = settings;
  return rest;
}
