import { test } from 'node:test';
import assert from 'node:assert/strict';
import { acpPermissionReq, acpPromptResultToStatus, acpUpdateToStatus, extractTextChoice } from './status-cursor.js';

test('agent_message_chunk accumulates answer as thinking', () => {
  const a = acpUpdateToStatus({ sessionUpdate: 'agent_message_chunk', content: { text: 'Hi' } });
  assert.equal(a.state, 'thinking');
  assert.equal(a.answer, 'Hi');
  const b = acpUpdateToStatus({ sessionUpdate: 'agent_message_chunk', content: { text: '!' } }, a);
  assert.equal(b.answer, 'Hi!');
});

test('tool_call -> working', () => {
  const s = acpUpdateToStatus({ sessionUpdate: 'tool_call', title: 'Shell', status: 'in_progress', rawInput: { command: 'npm test' } });
  assert.equal(s.state, 'working');
  assert.match(s.text, /Nikki: npm test|Nikki im Terminal/);
});

test('Read-like tool title uses describeTool', () => {
  const s = acpUpdateToStatus({ sessionUpdate: 'tool_call', title: 'Read', rawInput: { file_path: 'C:/p/a.js' } });
  assert.equal(s.text, 'Nikki liest a.js…');
});

test('prompt result stop reasons', () => {
  assert.equal(acpPromptResultToStatus({ stopReason: 'end_turn' }, 'ok').state, 'done');
  assert.equal(acpPromptResultToStatus({ stopReason: 'cancelled' }, '').state, 'idle');
  assert.equal(acpPromptResultToStatus({ stopReason: 'error' }, 'x').state, 'error');
});

test('permission req extracts tool + input', () => {
  const r = acpPermissionReq({ toolCall: { title: 'Bash', rawInput: { command: 'ls' } } });
  assert.equal(r.toolName, 'Bash');
  assert.equal(r.input.command, 'ls');
});

test('extractTextChoice parses Coucou-style paren options', () => {
  const c = extractTextChoice('Hörst du den Sound? (Ja / Nein)');
  assert.ok(c);
  assert.deepEqual(
    c.questions[0].options.map((o) => o.label),
    ['Ja', 'Nein'],
  );
});

test('extractTextChoice parses "oder" questions', () => {
  const c = extractTextChoice('Was magst du lieber: Tee oder Kaffee?');
  assert.ok(c);
  assert.deepEqual(
    c.questions[0].options.map((o) => o.label),
    ['Tee', 'Kaffee'],
  );
});

test('extractTextChoice ignores plain prose', () => {
  assert.equal(extractTextChoice('Alles klar, ich mache weiter.'), null);
});
