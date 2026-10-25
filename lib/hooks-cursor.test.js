import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CURSOR_EVENTS, withCursorHooks, withoutCursorHooks } from './hooks-cursor.js';

const CMD = 'node "C:/x/desktopcompanion/hook.cjs" "C:/u/DesktopCompanion/hook.json"';
const ponytail = { command: 'node "C:/p/ponytail-activate.js"', timeout: 15 };

test('withCursorHooks adds ours and keeps ponytail', () => {
  const s = withCursorHooks({ version: 1, hooks: { sessionStart: [ponytail] } }, CMD);
  assert.equal(s.version, 1);
  assert.deepEqual(s.hooks.sessionStart[0], ponytail);
  for (const e of CURSOR_EVENTS) assert.equal(s.hooks[e].filter((h) => h.command === CMD).length, 1);
});

test('withCursorHooks twice replaces path, no duplicates', () => {
  const s = withCursorHooks(withCursorHooks({ version: 1 }, CMD), CMD.replace('C:/x', 'D:/y'));
  assert.equal(s.hooks.stop.length, 1);
  assert.match(s.hooks.stop[0].command, /D:\/y/);
});

test('withoutCursorHooks restores foreign-only', () => {
  const orig = { version: 1, hooks: { beforeSubmitPrompt: [ponytail] } };
  assert.deepEqual(withoutCursorHooks(withCursorHooks(orig, CMD)), orig);
});
