import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EVENTS, withHooks, withoutHooks } from './hooks.js';

const CMD = 'node "C:/x/desktopcompanion/hook.cjs" "C:/u/DesktopCompanion/hook.json"';
const foreign = { type: 'command', command: 'echo hi' };

test('withHooks adds one async hook per event and keeps foreign hooks and settings', () => {
  const s = withHooks({ model: 'opus', hooks: { Stop: [{ hooks: [foreign] }] } }, CMD);
  assert.equal(s.model, 'opus');
  for (const e of EVENTS) assert.equal(s.hooks[e].flatMap((g) => g.hooks).filter((h) => h.command === CMD && h.async).length, 1);
  assert.deepEqual(s.hooks.Stop[0].hooks, [foreign]);
});

test('withHooks twice does not duplicate (path change replaces)', () => {
  const s = withHooks(withHooks({}, CMD), CMD.replace('C:/x', 'D:/y'));
  assert.equal(s.hooks.Stop.length, 1);
  assert.match(s.hooks.Stop[0].hooks[0].command, /D:\/y/);
});

test('withoutHooks restores the original settings', () => {
  const orig = { model: 'opus', hooks: { Stop: [{ hooks: [foreign] }] } };
  assert.deepEqual(withoutHooks(withHooks(orig, CMD)), orig);
  assert.deepEqual(withoutHooks(withHooks({ a: 1 }, CMD)), { a: 1 });
});
