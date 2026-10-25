// Resolves the installed Cursor CLI agent binary (never bare `agent` — that hits this repo's agent.js).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const base = () => path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'cursor-agent');

export function findCursorAgent() {
  const root = base();
  const versionsDir = path.join(root, 'versions');
  if (!fs.existsSync(versionsDir)) return null;
  const versions = fs
    .readdirSync(versionsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()
    .reverse();
  for (const v of versions) {
    const dir = path.join(versionsDir, v);
    const node = path.join(dir, 'node.exe');
    const index = path.join(dir, 'index.js');
    if (fs.existsSync(node) && fs.existsSync(index)) return { node, index, version: v, dir };
  }
  return null;
}
