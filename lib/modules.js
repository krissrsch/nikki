// Module data and the module list in the settings. The renderer is not trusted with paths: an id names one file in one folder.
import path from 'node:path';

export const MODULE_ID = /^[a-z0-9-]{1,40}$/;

// userData/modules/<id>.json; anything else (dots, slashes, drive letters, empty) throws
export function moduleFile(dir, id) {
  if (typeof id !== 'string' || !MODULE_ID.test(id)) throw new Error(`invalid module id: ${String(id).slice(0, 60)}`);
  return path.join(dir, `${id}.json`);
}

// Order matches the tab bar in the UI spec (calendar, to-do, notes, timer); new modules come later, switched off.
export const DEFAULT_MODULES = ['calendar', 'todo', 'notes', 'timer'].map((id) => ({ id, on: true }));

// [{ id, on }] in the user's order: valid ids only, each once. Anything that is not a list keeps the fallback.
export function normalizeModules(list, fallback = DEFAULT_MODULES) {
  if (!Array.isArray(list)) return fallback;
  const seen = new Set();
  return list.flatMap((m) => {
    if (!m || typeof m.id !== 'string' || !MODULE_ID.test(m.id) || seen.has(m.id)) return [];
    seen.add(m.id);
    return [{ id: m.id, on: !!m.on }];
  });
}
