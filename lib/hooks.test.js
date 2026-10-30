import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EVENTS, MARK, hookCommandIn, withHooks, withoutHooks } from './hooks.js';

const CMD = 'node "C:/x/desktopcompanion/hook.cjs" "C:/u/DesktopCompanion/hook.json"';
const foreign = { type: 'command', command: 'echo hi' };

test('withHooks adds one marked async hook per event and keeps foreign hooks and settings', () => {
  const s = withHooks({ model: 'opus', hooks: { Stop: [{ hooks: [foreign] }] } }, CMD);
  assert.equal(s.model, 'opus');
  for (const e of EVENTS) assert.equal(s.hooks[e].flatMap((g) => g.hooks).filter((h) => h.command === `${CMD} ${MARK}` && h.async).length, 1);
  assert.deepEqual(s.hooks.Stop[0].hooks, [foreign]);
  assert.equal(hookCommandIn(s), `${CMD} ${MARK}`);
  assert.equal(hookCommandIn({ hooks: { Stop: [{ hooks: [foreign] }] } }), null);
});

test('withHooks twice does not duplicate (path change replaces)', () => {
  const s = withHooks(withHooks({}, CMD), CMD.replace('C:/x', 'D:/y'));
  assert.equal(s.hooks.Stop.length, 1);
  assert.match(s.hooks.Stop[0].hooks[0].command, /D:\/y/);
});

test('withoutHooks restores the original settings, key order included (B14)', () => {
  const orig = { model: 'opus', hooks: { Stop: [{ hooks: [foreign] }] }, env: { A: '1' } };
  assert.equal(JSON.stringify(withoutHooks(withHooks(orig, CMD))), JSON.stringify(orig));
  assert.equal(JSON.stringify(withoutHooks(withHooks({ a: 1 }, CMD))), JSON.stringify({ a: 1 }));
  assert.deepEqual(Object.keys(withHooks(orig, CMD)), ['model', 'hooks', 'env']);
});

test('withoutHooks keeps the user\'s own empty groups and an empty hooks object (N4)', () => {
  const orig = { hooks: { Stop: [{ matcher: 'x', hooks: [] }] } };
  assert.deepEqual(withoutHooks(withHooks(orig, CMD)), orig);
  assert.deepEqual(withoutHooks({ hooks: {} }), { hooks: {} });
  assert.deepEqual(withoutHooks({ hooks: { PreToolUse: [] } }), { hooks: { PreToolUse: [] } });
});

test('hooks written by 1.0 (no marker) are still found and replaced', () => {
  const old = { hooks: { Stop: [{ hooks: [{ type: 'command', command: CMD, async: true }] }] } };
  assert.equal(hookCommandIn(old), CMD);
  assert.deepEqual(withoutHooks(old), {});
  assert.equal(withHooks(old, CMD).hooks.Stop.length, 1);
});

test('relay: PermissionRequest becomes one synchronous waiting hook, the other events stay async observers', () => {
  const s = withHooks({}, CMD, { relay: true });
  const [pr] = s.hooks.PermissionRequest.flatMap((g) => g.hooks);
  assert.equal(s.hooks.PermissionRequest.length, 1);
  assert.equal(pr.command, `${CMD} --wait ${MARK}`);
  assert.equal(pr.async, undefined);
  assert.equal(pr.timeout, 120);
  assert.equal(s.hooks.Stop[0].hooks[0].async, true);
  // switching the relay off again swaps the hook back; removing restores the original
  assert.equal(withHooks(s, CMD).hooks.PermissionRequest[0].hooks[0].async, true);
  assert.deepEqual(withoutHooks(s), {});
});
