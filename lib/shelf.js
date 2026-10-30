// The shelf (Ablage): copies of dropped files in userData/shelf. Pure parts; main.js does the file work.
import path from 'node:path';

export const SHELF_FILE_MAX = 500 * 1024 ** 2;
export const SHELF_TOTAL_MAX = 2 * 1024 ** 3;

// "12 KB", "1,2 MB", "18 MB": steps of 1024, one decimal below 10
export function formatSize(bytes) {
  const units = ['B', 'KB', 'MB', 'GB'];
  let n = Math.max(0, Number(bytes) || 0);
  let i = 0;
  for (; n >= 1024 && i < units.length - 1; i++) n /= 1024;
  const num = i && n < 10 ? n.toFixed(1).replace('.', ',').replace(/,0$/, '') : String(Math.round(n));
  return `${num} ${units[i]}`;
}

// "a.png" → "a (2).png" while the name is taken; Windows compares names without case
export function uniqueName(name, taken) {
  const used = new Set([...taken].map((n) => n.toLowerCase()));
  const ext = path.extname(name);
  const base = name.slice(0, name.length - ext.length);
  let next = name;
  for (let i = 2; used.has(next.toLowerCase()); i++) next = `${base} (${i})${ext}`;
  return next;
}

// What fits: each file up to 500 MB, all of the shelf up to 2 GB. files: [{ src, name, size }], used: bytes on the shelf now,
// taken: names in the folder. ok gets a free name per file; errors are sentences for the user.
export function planAdd(files, used, taken) {
  const names = [...taken];
  const ok = [];
  const errors = [];
  let total = used;
  for (const f of files) {
    if (f.size > SHELF_FILE_MAX) errors.push(`„${f.name}“ ist zu groß (${formatSize(f.size)}). In die Ablage passen höchstens 500 MB pro Datei.`);
    else if (total + f.size > SHELF_TOTAL_MAX) errors.push(`„${f.name}“ passt nicht mehr rein: Die Ablage fasst 2 GB. Leer sie, dann geht es wieder.`);
    else {
      const name = uniqueName(f.name, names);
      names.push(name);
      total += f.size;
      ok.push({ ...f, name });
    }
  }
  return { ok, errors };
}

// A plain file name inside the shelf folder. Names come from shelf.json, which anyone can edit: a path in it throws.
export function shelfFile(dir, name) {
  if (typeof name !== 'string' || !name || name === '.' || name === '..' || /[\\/:\0]/.test(name)) throw new Error(`invalid shelf name: ${String(name).slice(0, 60)}`);
  return path.join(dir, name);
}
