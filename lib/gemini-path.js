// Resolves the Gemini CLI (`@google/gemini-cli`) for AI Studio chat — Google login, no Companion API key.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function exists(p) {
  try {
    return !!p && fs.existsSync(p);
  } catch {
    return false;
  }
}

export function findGemini() {
  try {
    const out = execFileSync(process.platform === 'win32' ? 'where.exe' : 'which', ['gemini'], {
      windowsHide: true,
      encoding: 'utf8',
      timeout: 3000,
    });
    const first = out.split(/\r?\n/).map((s) => s.trim()).find(Boolean);
    if (exists(first)) return first;
  } catch {}

  const home = os.homedir();
  const candidates = [
    path.join(process.env.APPDATA || '', 'npm', 'gemini.cmd'),
    path.join(process.env.APPDATA || '', 'npm', 'gemini'),
    path.join(home, '.npm-global', 'bin', 'gemini'),
    path.join(home, '.local', 'bin', 'gemini'),
  ];
  for (const c of candidates) {
    if (exists(c)) return c;
  }
  return null;
}
