// Bugs found in the code review (notes/audit/code-review.md). They were todo until the fixes landed in 1.1;
// now they guard against the bugs coming back.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withHooks, withoutHooks } from './hooks.js';
import { hookToStatus, toStatus } from './status.js';

const waiting = { state: 'needsYou', text: 'Nikki will OK!' };

test('M1: PostToolUse of a parallel tool must not hide an open permission prompt', () => {
  // Read finished a few ms before the Bash prompt opened; async hooks deliver it after PermissionRequest
  const late = { hook_event_name: 'PostToolUse', tool_name: 'Read', tool_input: { file_path: 'C:/p/a.js' } };
  assert.equal(hookToStatus(late, waiting)?.state ?? waiting.state, 'needsYou');
});

test('M2: PermissionRequest for AskUserQuestion keeps the question text', () => {
  const ask = { state: 'needsYou', text: 'Nikki: Tee oder Kaffee? (Tee / Kaffee)' };
  const perm = { hook_event_name: 'PermissionRequest', tool_name: 'AskUserQuestion', tool_input: { questions: [] } };
  assert.equal((hookToStatus(perm, ask) ?? ask).text, ask.text);
});

test('M3: idle_prompt clears a needsYou left over from a prompt denied in the terminal', () => {
  const idle = { hook_event_name: 'Notification', notification_type: 'idle_prompt' };
  assert.notEqual((hookToStatus(idle, waiting) ?? waiting).state, 'needsYou');
});

test('N1: error result with empty errors[] still says why', () => {
  const s = toStatus({ type: 'result', subtype: 'error_max_turns', is_error: true, errors: [] });
  assert.ok(s.answer, `answer is ${JSON.stringify(s.answer)}`);
});

test('M7: hooks stay recognisable when the install path no longer says "desktopcompanion"', () => {
  // e.g. after renaming package.json "name" to nikki: Programs\nikki + %APPDATA%\nikki
  const cmd = '"C:/Program Files/nodejs/node.exe" "C:/Users/u/AppData/Local/Programs/nikki/resources/app/hook.cjs" "C:/Users/u/AppData/Roaming/nikki/hook.json"';
  assert.equal(withHooks(withHooks({}, cmd), cmd).hooks.Stop.length, 1, 'every app start appends 8 more hooks');
  assert.deepEqual(withoutHooks(withHooks({}, cmd)), {}, 'switching off leaves the hooks in settings.json');
});
