import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hookToStatus, toAnswers, toStatus } from './status.js';

const assistant = (...content) => ({ type: 'assistant', message: { content } });

test('init -> thinking', () => {
  assert.equal(toStatus({ type: 'system', subtype: 'init' }).state, 'thinking');
});

test('tool calls -> working with readable text', () => {
  assert.deepEqual(toStatus(assistant({ type: 'tool_use', name: 'Read', input: { file_path: 'C:\\p\\src\\App.tsx' } })), {
    state: 'working',
    text: 'Nikki liest App.tsx…',
  });
  assert.equal(toStatus(assistant({ type: 'tool_use', name: 'Edit', input: { file_path: '/p/a.js' } })).text, 'Nikki tippt a.js…');
  assert.match(toStatus(assistant({ type: 'tool_use', name: 'PowerShell', input: { command: 'npm test\nmore' } })).text, /Nikki: npm test/);
  assert.equal(toStatus(assistant({ type: 'tool_use', name: 'mcp__x__y', input: {} })).text, 'Nikki arbeitet…');
  assert.equal(toStatus(assistant({ type: 'tool_use', name: 'AskUserQuestion', input: {} })).text, 'Nikki fragt…');
});

test('last tool_use wins, plain text -> thinking', () => {
  const m = assistant({ type: 'text', text: 'hi' }, { type: 'tool_use', name: 'Grep', input: { pattern: 'foo' } });
  assert.equal(toStatus(m).text, 'Nikki sucht…');
  assert.equal(toStatus(assistant({ type: 'text', text: 'hi' })).state, 'thinking');
});

test('result success / error', () => {
  assert.deepEqual(toStatus({ type: 'result', subtype: 'success', is_error: false, result: 'ok' }), {
    state: 'done',
    text: 'Nikki ist fertig.',
    answer: 'ok',
  });
  assert.equal(toStatus({ type: 'result', subtype: 'error_max_turns', is_error: true }).state, 'error');
});

test('unrelated messages -> null', () => {
  assert.equal(toStatus({ type: 'user' }), null);
});

test('toAnswers: single, multi and free text keyed by question', () => {
  const qs = [{ question: 'Farbe?' }, { question: 'Extras?' }, { question: 'Name?' }];
  assert.deepEqual(toAnswers(qs, [['rot'], ['A', 'B'], ['Mimi']]), { 'Farbe?': 'rot', 'Extras?': 'A, B', 'Name?': 'Mimi' });
});

test('hook events -> status', () => {
  assert.deepEqual(hookToStatus({ hook_event_name: 'PreToolUse', tool_name: 'Read', tool_input: { file_path: 'C:/p/a.js' } }), {
    state: 'working',
    text: 'Nikki liest a.js…',
  });
  assert.equal(hookToStatus({ hook_event_name: 'Notification', notification_type: 'permission_prompt' }).state, 'needsYou');
  assert.equal(hookToStatus({ hook_event_name: 'Notification', notification_type: 'idle_prompt' }), null);
  assert.equal(hookToStatus({ hook_event_name: 'Stop' }).state, 'done');
  assert.equal(hookToStatus({ hook_event_name: 'SubagentStop' }), null);
});

test('terminal questions and permissions show what Claude wants', () => {
  const ask = {
    hook_event_name: 'PreToolUse',
    tool_name: 'AskUserQuestion',
    tool_input: { questions: [{ question: 'Tee oder Kaffee?', options: [{ label: 'Tee' }, { label: 'Kaffee' }] }] },
  };
  assert.deepEqual(hookToStatus(ask), { state: 'needsYou', text: 'Nikki: Tee oder Kaffee? (Tee / Kaffee)' });
  const perm = { hook_event_name: 'PermissionRequest', tool_name: 'Bash', tool_input: { command: 'npm test' } };
  assert.deepEqual(hookToStatus(perm), { state: 'needsYou', text: 'Nikki will OK!' });
});

test('a waiting terminal session stays waiting until the tool ran', () => {
  const waiting = { state: 'needsYou', text: 'Nikki will OK!' };
  const pre = { hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'npm test' } };
  assert.equal(hookToStatus(pre, waiting), null); // out-of-order PreToolUse
  assert.deepEqual(hookToStatus({ hook_event_name: 'Notification', notification_type: 'permission_prompt' }, waiting), waiting);
  assert.equal(hookToStatus({ hook_event_name: 'PostToolUse', tool_name: 'Bash', tool_input: { command: 'npm test' } }, waiting).state, 'working');
  assert.equal(hookToStatus({ hook_event_name: 'Stop' }, waiting).state, 'done');
});
