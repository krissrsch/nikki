import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRelay } from './relay.js';

const clock = () => {
  let t = 1000;
  return { now: () => t, tick: (ms) => (t += ms) };
};
const ev = (hook_event_name, extra = {}) => ({ hook_event_name, session_id: 's1', ...extra });

test('an answer reaches the waiting hook once', () => {
  const r = createRelay();
  const got = [];
  const { id } = r.wait(ev('PermissionRequest', { tool_name: 'Bash' }), (x) => got.push(x));
  assert.equal(r.answer(id, { answer: 'allow' }), true);
  assert.equal(r.answer(id, { answer: 'deny' }), false);
  assert.deepEqual(got, [{ answer: 'allow' }]);
  assert.equal(r.size, 0);
});

test('answered in the terminal: the next turn event settles the card silently (#15433)', () => {
  for (const name of ['Stop', 'UserPromptSubmit', 'SessionEnd']) {
    const r = createRelay();
    const got = [];
    const { id } = r.wait(ev('PermissionRequest', { tool_name: 'Bash' }), (x) => got.push(x));
    assert.deepEqual(r.onEvent(ev(name)), [id]);
    assert.deepEqual(got, [null]);
  }
});

test('PostToolUse settles only the asked tool, and only after the grace (late async event of an earlier tool, M1)', () => {
  const c = clock();
  const r = createRelay({ now: c.now });
  const got = [];
  const { id } = r.wait(ev('PermissionRequest', { tool_name: 'Bash' }), (x) => got.push(x));
  assert.deepEqual(r.onEvent(ev('PostToolUse', { tool_name: 'Read' })), []);
  assert.deepEqual(r.onEvent(ev('PostToolUse', { tool_name: 'Bash' })), []); // too soon: an earlier Bash call
  c.tick(1000);
  assert.deepEqual(r.onEvent(ev('PostToolUse', { tool_name: 'Bash' })), [id]);
  assert.deepEqual(got, [null]);
});

test('other sessions and observer events leave the card alone', () => {
  const r = createRelay();
  r.wait(ev('PermissionRequest', { tool_name: 'Bash' }), () => {});
  assert.deepEqual(r.onEvent({ hook_event_name: 'Stop', session_id: 's2' }), []);
  assert.deepEqual(r.onEvent(ev('PreToolUse', { tool_name: 'Bash' })), []);
  assert.deepEqual(r.onEvent(ev('Notification')), []);
  assert.deepEqual(r.onEvent({ hook_event_name: 'Stop' }), []);
  assert.equal(r.size, 1);
});

test('a new request of the same session replaces the old one; cancelAll falls back to the terminal', () => {
  const r = createRelay();
  const got = [];
  const a = r.wait(ev('PermissionRequest', { tool_name: 'Bash' }), (x) => got.push(['a', x]));
  const b = r.wait(ev('PermissionRequest', { tool_name: 'Write' }), (x) => got.push(['b', x]));
  assert.deepEqual(b.replaced, [a.id]);
  r.wait({ hook_event_name: 'PermissionRequest', session_id: 's2' }, (x) => got.push(['c', x]));
  assert.equal(r.cancelAll().length, 2);
  assert.deepEqual(got, [['a', null], ['b', null], ['c', null]]);
});
