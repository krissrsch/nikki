// JSON files that must survive a crash mid-write: Nikki's own state and the user's ~/.claude/settings.json.
import fs from 'node:fs';
import path from 'node:path';

// Missing file -> undefined. A UTF-8 BOM (older editors) is fine. Broken JSON throws, unless onCorrupt is given:
// then the file is moved to <file>.corrupt-<ts> (never overwritten by the next save), onCorrupt(newPath) runs and undefined comes back.
export function readJson(file, onCorrupt) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (e) {
    if (e.code === 'ENOENT') return undefined;
    throw e;
  }
  try {
    return JSON.parse(text.replace(/^﻿/, ''));
  } catch (e) {
    if (!onCorrupt) throw e;
    const moved = `${file}.corrupt-${Date.now()}`;
    fs.renameSync(file, moved);
    onCorrupt(moved);
    return undefined;
  }
}

// Temp file next to the target, then rename: a crash leaves the old or the new file, never half of one.
// A symlinked file (dotfiles) keeps its link; the real file behind it is replaced.
export function writeJsonAtomic(file, value) {
  let real = file;
  try {
    real = fs.realpathSync(file);
  } catch {}
  fs.mkdirSync(path.dirname(real), { recursive: true });
  const tmp = `${real}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
    fs.renameSync(tmp, real);
  } catch (e) {
    fs.rmSync(tmp, { force: true });
    throw e;
  }
}

const mtime = (file) => {
  try {
    return fs.statSync(file).mtimeMs;
  } catch {
    return null;
  }
};

// Read-modify-write of a file someone else owns too. Returns false when mutate changed nothing (no write at all).
// backup: copied once, only while none exists yet and pristine(content) says the file has none of our changes.
// If the file changes between reading and writing (Claude Code saving /model at the same moment), it is read again.
export function editJson(file, mutate, { backup, pristine = () => true } = {}) {
  for (let tries = 0; ; tries++) {
    const seen = mtime(file);
    const before = readJson(file);
    const after = mutate(before ?? {});
    if (JSON.stringify(after) === JSON.stringify(before ?? {})) return false; // same content and key order
    if (backup && before !== undefined && !fs.existsSync(backup) && pristine(before)) fs.copyFileSync(file, backup);
    if (mtime(file) !== seen && tries < 3) continue;
    writeJsonAtomic(file, after);
    return true;
  }
}
