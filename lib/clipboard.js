// Clipboard history for the opt-in module "clipboard" (plan 3.8). Pure: main polls the system clipboard and keeps the list.
// list: [{ text, at }], newest first.
export const MAX_ITEMS = 50;
export const MAX_CHARS = 5000;

// A copied text goes on top; one that is there already moves up instead of coming twice. Blank or non-text changes nothing
// (the very same list comes back, so main sends nothing).
export function addClip(list, text, now, { max = MAX_ITEMS, maxChars = MAX_CHARS } = {}) {
  if (typeof text !== 'string' || !text.trim()) return list;
  const t = text.slice(0, maxChars);
  if (list[0]?.text === t) return list;
  return [{ text: t, at: now }, ...list.filter((c) => c.text !== t)].slice(0, max);
}

export const removeClip = (list, text) => list.filter((c) => c.text !== text);

// "Verlauf merken": the saved file is read back through addClip, so whatever is in it ends up as a clean, capped list
export const restoreClips = (items) =>
  (Array.isArray(items) ? [...items].reverse() : []).reduce((list, c) => addClip(list, c?.text, Number(c?.at) || 0), []);
