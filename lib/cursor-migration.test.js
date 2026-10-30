import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withoutCursorHooks } from './cursor-migration.js';

const ours = { command: 'node "C:/x/desktopcompanion/hook.cjs" "C:/u/DesktopCompanion/hook.json"' };
const ponytail = { command: 'node "C:/p/ponytail-activate.js"', timeout: 15 };

test('withoutCursorHooks removes ours and keeps foreign hooks in place', () => {
  const s = { version: 1, hooks: { sessionStart: [ponytail, ours], stop: [ours] }, other: true };
  const out = withoutCursorHooks(s);
  assert.deepEqual(out, { version: 1, hooks: { sessionStart: [ponytail] }, other: true });
  assert.deepEqual(Object.keys(out), ['version', 'hooks', 'other']);
});

test('withoutCursorHooks drops hooks only when we emptied it', () => {
  assert.deepEqual(withoutCursorHooks({ version: 1, hooks: { stop: [ours] } }), { version: 1 });
  assert.deepEqual(withoutCursorHooks({ version: 1, hooks: {} }), { version: 1, hooks: {} });
  assert.deepEqual(withoutCursorHooks({ version: 1 }), { version: 1 });
});
