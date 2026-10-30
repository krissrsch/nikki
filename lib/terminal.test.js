import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DONE_MS, STALE_MS, onHook, sweep } from './terminal.js';

const ev = (hook_event_name, more = {}) => ({ hook_event_name, session_id: 'a', cwd: 'C:/p/app', ...more });

test('events update one session and report a state change once', () => {
  let r = onHook(new Map(), ev('UserPromptSubmit'), 1000);
  assert.equal(r.changed, 'thinking');
  assert.deepEqual(r.sessions.get('a'), { id: 'a', cwd: 'C:/p/app', state: 'thinking', text: 'Nikki denkt…', at: 1000 });
  r = onHook(r.sessions, ev('PreToolUse', { tool_name: 'Read', tool_input: { file_path: 'x.js' } }), 2000);
  assert.equal(r.changed, 'working');
  r = onHook(r.sessions, ev('PreToolUse', { tool_name: 'Read', tool_input: { file_path: 'y.js' } }), 3000);
  assert.equal(r.changed, undefined);
  assert.equal(r.sessions.get('a').text, 'Nikki liest y.js…');
});

test('nothing to change keeps the very same map (no send)', () => {
  const m = new Map();
  assert.equal(onHook(m, ev('SubagentStop'), 1).sessions, m);
  assert.equal(onHook(m, ev('SessionEnd'), 1).sessions, m);
  assert.equal(onHook(m, { hook_event_name: 'Stop' }, 1).sessions, m);
  assert.equal(sweep(m, 1), m);
});

test('a permission prompt survives a late PostToolUse of a parallel tool (M1)', () => {
  let { sessions } = onHook(new Map(), ev('PermissionRequest', { tool_name: 'Bash', tool_input: { command: 'rm x' } }), 1);
  ({ sessions } = onHook(sessions, ev('PostToolUse', { tool_name: 'Read' }), 2));
  assert.equal(sessions.get('a').state, 'needsYou');
  ({ sessions } = onHook(sessions, ev('PostToolUse', { tool_name: 'Bash', tool_input: { command: 'rm x' } }), 3));
  assert.equal(sessions.get('a').state, 'working');
});

test('SessionEnd removes the session', () => {
  const { sessions } = onHook(new Map(), ev('Stop'), 1);
  assert.equal(onHook(sessions, ev('SessionEnd'), 2).sessions.has('a'), false);
});

test('sweep: done goes quiet after DONE_MS, a silent session goes after STALE_MS (M4)', () => {
  const { sessions } = onHook(new Map(), ev('Stop'), 0);
  assert.equal(sweep(sessions, DONE_MS - 1), sessions);
  const quiet = sweep(sessions, DONE_MS + 1);
  assert.equal(quiet.get('a').state, 'idle');
  assert.equal(quiet.get('a').at, 0);
  assert.equal(sweep(quiet, STALE_MS + 1).has('a'), false);
  // a new event also clears out other dead sessions
  assert.equal(onHook(sessions, { ...ev('UserPromptSubmit'), session_id: 'b' }, STALE_MS + 1).sessions.has('a'), false);
});
