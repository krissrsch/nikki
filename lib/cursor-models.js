// Lists Cursor CLI models for this account (`agent models`). Falls back if the CLI is missing.
import { execFileSync } from 'node:child_process';
import { findCursorAgent } from './cursor-path.js';

/** Popular picks pinned to the top of the menu (must exist in the CLI list to appear). */
const PIN = [
  'auto',
  'composer-2.5',
  'composer-2.5-fast',
  'grok-4.7-high',
  'cursor-grok-4.6-high',
  'gpt-5.5-medium',
  'gpt-5.6-sol-medium',
  'claude-opus-5-5-medium',
  'claude-opus-5-thinking-high',
  'claude-sonnet-5-thinking-high',
  'gemini-4-argon-high',
  'gpt-5.3-codex',
];

const FALLBACK = [
  [null, 'Auto'],
  ['composer-2.5', 'Composer 2.5'],
  ['composer-2.5-fast', 'Composer 2.5 Fast'],
  ['grok-4.7-high', 'Grok 4.7 High'],
  ['cursor-grok-4.6-high', 'Grok 4.6'],
  ['gpt-5.5-medium', 'GPT-5.5'],
  ['gpt-5.6-sol-medium', 'GPT-5.6 Sol'],
  ['claude-opus-5-5-medium', 'Claude Opus 5.5'],
  ['claude-sonnet-5-thinking-high', 'Claude Sonnet 5 Thinking'],
  ['gemini-4-argon-high', 'Gemini 4 Argon'],
  ['gpt-5.3-codex', 'Codex 5.3'],
];

function parseModels(text) {
  const out = [];
  for (const line of String(text).split(/\r?\n/)) {
    const m = line.match(/^(\S+)\s+-\s+(.+)$/);
    if (!m) continue;
    const id = m[1];
    const label = m[2].replace(/\u200b/g, '').trim(); // strip zero-width junk from some labels
    out.push([id === 'auto' ? null : id, id === 'auto' ? 'Auto' : label]);
  }
  return out;
}

function sortPinned(list) {
  const rank = new Map(PIN.map((id, i) => [id === 'auto' ? null : id, i]));
  return [...list].sort((a, b) => {
    const ra = rank.has(a[0]) ? rank.get(a[0]) : 1000;
    const rb = rank.has(b[0]) ? rank.get(b[0]) : 1000;
    if (ra !== rb) return ra - rb;
    return String(a[1]).localeCompare(String(b[1]), 'en');
  });
}

let cached = null;
let cachedAt = 0;
const TTL_MS = 5 * 60 * 1000;

/** Instant: last fetch or short fallback (does not call the CLI). */
export function peekCursorModels() {
  return cached ?? FALLBACK;
}

/** Sync CLI fetch (`agent models`). Prefer peek + async refresh on the UI path. */
export function listCursorModels({ force = false } = {}) {
  if (!force && cached && Date.now() - cachedAt < TTL_MS) return cached;
  const bin = findCursorAgent();
  if (!bin) {
    cached = FALLBACK;
    cachedAt = Date.now();
    return cached;
  }
  try {
    const text = execFileSync(bin.node, [bin.index, 'models'], {
      windowsHide: true,
      timeout: 12000,
      encoding: 'utf8',
      maxBuffer: 2 * 1024 * 1024,
    });
    const parsed = parseModels(text);
    cached = parsed.length ? sortPinned(parsed) : FALLBACK;
  } catch {
    cached = FALLBACK;
  }
  cachedAt = Date.now();
  return cached;
}
