import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { hookToStatus } from './lib/status.js';

const { slim, decision, stopDecision } = createRequire(import.meta.url)('./hook.cjs');

test('slim drops tool output and file contents and cuts long commands (M10)', () => {
  const raw = {
    hook_event_name: 'PostToolUse',
    session_id: 's1',
    cwd: 'C:/p',
    tool_name: 'Write',
    transcript_path: 'C:/u/.claude/x.jsonl',
    tool_input: { file_path: 'C:/p/a.js', content: 'x'.repeat(2e6), command: 'y'.repeat(500) },
    tool_response: { originalFile: 'z'.repeat(2e6) },
  };
  const out = slim(raw);
  assert.ok(JSON.stringify(out).length < 2000);
  assert.equal(out.tool_input.content, undefined);
  assert.equal(out.tool_response, undefined);
  assert.equal(out.tool_input.command.length, 200);
  assert.equal(hookToStatus(out).text, 'Nikki tippt a.js…');
});

test('slim keeps what a question needs', () => {
  const raw = {
    hook_event_name: 'PreToolUse',
    tool_name: 'AskUserQuestion',
    tool_input: { questions: [{ question: 'Tee oder Kaffee?', header: 'x', options: [{ label: 'Tee', description: 'heiß' }, { label: 'Kaffee' }] }] },
  };
  assert.equal(hookToStatus(slim(raw)).text, 'Nikki: Tee oder Kaffee? (Tee / Kaffee)');
  assert.equal(slim({}).tool_input.questions, undefined);
});

test('decision: allow, always with the suggested rules, deny with a reason (relay)', () => {
  const raw = { tool_name: 'Bash', tool_input: { command: 'npm test' }, permission_suggestions: [{ type: 'addRules', rules: [{ toolName: 'Bash' }] }] };
  const d = (reply) => decision(raw, reply)?.hookSpecificOutput;
  assert.deepEqual(d({ answer: 'allow' }), { hookEventName: 'PermissionRequest', decision: { behavior: 'allow' } });
  assert.deepEqual(d({ answer: 'always' }).decision.updatedPermissions, raw.permission_suggestions);
  assert.deepEqual(d({ answer: 'deny', message: 'Nicht jetzt' }).decision, { behavior: 'deny', message: 'Nicht jetzt' });
  assert.equal(d({ answer: 'deny' }).decision.message, 'Abgelehnt in Nikki.');
  // "always" without suggestions is a plain allow
  assert.equal(decision({ tool_input: {} }, { answer: 'always' }).hookSpecificOutput.decision.updatedPermissions, undefined);
});

test('decision: question picks go back inside the tool input; no or unknown answer stays silent', () => {
  const raw = { tool_name: 'AskUserQuestion', tool_input: { questions: [{ question: 'Tee oder Kaffee?' }] } };
  const d = decision(raw, { answer: 'allow', answers: { 'Tee oder Kaffee?': 'Tee' } }).hookSpecificOutput.decision;
  assert.deepEqual(d.updatedInput, { questions: [{ question: 'Tee oder Kaffee?' }], answers: { 'Tee oder Kaffee?': 'Tee' } });
  assert.equal(decision(raw, null), null);
  assert.equal(decision(raw, { answer: 'terminal' }), null);
});

test('stopDecision: a queued message keeps Claude working, nothing queued lets it stop', () => {
  assert.deepEqual(stopDecision({ message: ' Bitte noch Tests schreiben ' }), { decision: 'block', reason: 'Nachricht des Nutzers aus Nikki: Bitte noch Tests schreiben' });
  assert.equal(stopDecision({ message: '   ' }), null);
  assert.equal(stopDecision(null), null);
});
