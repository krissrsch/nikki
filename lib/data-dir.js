// Where the installed Nikki keeps its data: Roaming\notch-nikki. Up to 1.4 it was Roaming\desktopcompanion, the old package name.
// The old folder is moved once; the paths state.json keeps follow it, and Claude Code's transcripts of the general chat
// (filed by folder) are copied, so those chats can go on.
import fs from 'node:fs';
import path from 'node:path';
import { readJson, writeJsonAtomic } from './json-file.js';

const DATA_DIR = 'notch-nikki';
const OLD_DIR = 'desktopcompanion';
const transcriptsOf = (claudeDir, folder) => path.join(claudeDir, 'projects', folder.replace(/[^a-zA-Z0-9]/g, '-')); // Claude Code's naming

// a path is moved only when it is the old folder or lies inside it: a chat message that mentions it, or a sibling
// folder whose name merely starts the same (desktopcompanion-backup), stays as it is; object keys (models per folder) too
function movePaths(v, from, to) {
  const move = (s) => (s === from || s.startsWith(from + path.sep) ? to + s.slice(from.length) : s);
  if (typeof v === 'string') return move(v);
  if (Array.isArray(v)) return v.map((x) => movePaths(x, from, to));
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [move(k), movePaths(x, from, to)]));
  return v;
}

// -> the folder to use. When the old one cannot be moved now (an old Nikki still runs), it stays in use and the next start tries again.
export function moveDataDir(appData, claudeDir) {
  const to = path.join(appData, DATA_DIR);
  const from = path.join(appData, OLD_DIR);
  if (fs.existsSync(to) || !fs.existsSync(from)) return to;
  try {
    fs.renameSync(from, to);
  } catch (e) {
    console.error('data folder not moved:', e.message);
    return from;
  }
  const state = path.join(to, 'state.json');
  try {
    const old = readJson(state);
    if (old) writeJsonAtomic(state, movePaths(old, from, to)); // the general chat's folder, models per folder
  } catch (e) {
    console.error('state.json not updated:', e.message);
  }
  try {
    const transcripts = transcriptsOf(claudeDir, path.join(from, 'allgemein'));
    const next = transcriptsOf(claudeDir, path.join(to, 'allgemein'));
    if (fs.existsSync(transcripts) && !fs.existsSync(next)) fs.cpSync(transcripts, next, { recursive: true }); // a copy: the old ones stay
  } catch (e) {
    console.error('general chat transcripts not copied:', e.message);
  }
  return to;
}
