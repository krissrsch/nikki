import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { hookToStatus } from './lib/status.js';

const { slim } = createRequire(import.meta.url)('./hook.cjs');

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
