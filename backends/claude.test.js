import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClaudeAgent } from './claude.js';

const tick = () => new Promise((r) => setTimeout(r, 5));
const init = { type: 'system', subtype: 'init', session_id: 's1', claude_code_version: '2.1.308' };
const ok = { type: 'result', subtype: 'success', is_error: false, result: 'fertig!' };

// A fake SDK query: script(ctl) is an async generator; ctl tells it about interrupt() and the abort signal.
function setup(script, extra = {}) {
  const statuses = [];
  const calls = [];
  const agent = createClaudeAgent({
    claudePath: 'claude.exe',
    onStatus: (s) => statuses.push(s),
    onSession: () => {},
    askPermission: async () => ({ answer: 'allow' }),
    query: (args) => {
      const ctl = { interrupted: false, signal: args.options.abortController.signal, n: calls.length };
      calls.push(args);
      return Object.assign(script(ctl), { interrupt: async () => void (ctl.interrupted = true) });
    },
    killAfterMs: 20,
    ...extra,
  });
  return { agent, statuses, calls, closing: () => statuses.filter((s) => ['done', 'error', 'idle'].includes(s.state)) };
}

test('a stream that ends without a result still closes the turn (H4)', async () => {
  const { agent, closing } = setup(async function* () {
    yield init;
  });
  agent.start('hi', '.', undefined);
  await tick();
  assert.deepEqual(closing(), [{ state: 'error', text: 'Nikki stolpert.', answer: 'Agent beendet ohne Ergebnis.' }]);
  assert.equal(agent.busy(), false);
});

test('query() throwing synchronously gives an error status, not a stuck island (H4)', async () => {
  const { agent, closing } = setup(() => {
    throw new Error('spawn ENOENT');
  });
  assert.equal(agent.start('hi', '.', undefined), true);
  await tick();
  assert.deepEqual(closing(), [{ state: 'error', text: 'Nikki stolpert.', answer: 'spawn ENOENT' }]);
  assert.equal(agent.busy(), false);
});

test('done frees the start at once; a prompt sent while the CLI exits waits for it (B4)', async () => {
  let release;
  const exiting = new Promise((r) => (release = r));
  const { agent, statuses, calls } = setup(async function* (ctl) {
    yield init;
    yield ok;
    if (ctl.n === 0) await exiting;
  });
  agent.start('eins', '.', undefined);
  await tick();
  assert.deepEqual(statuses.at(-1), { state: 'done', text: 'Nikki ist fertig.', answer: 'fertig!' });
  assert.equal(agent.busy(), false);
  assert.equal(agent.start('zwei', '.', 's1'), true);
  assert.equal(agent.busy(), true);
  assert.equal(agent.start('drei', '.', 's1'), false);
  await tick();
  assert.equal(calls.length, 1, 'the second CLI waits for the first to exit');
  release();
  await tick();
  assert.equal(calls.length, 2);
  assert.equal(calls[1].prompt, 'zwei');
  assert.equal(calls[1].options.resume, 's1');
  assert.equal(statuses.filter((s) => s.state === 'done').length, 2);
});

test('stop: interrupt, and the error result that follows reads as stopped without its diagnostic (M5, B5)', async () => {
  const { agent, closing } = setup(async function* (ctl) {
    yield init;
    while (!ctl.interrupted) await tick();
    yield { type: 'result', subtype: 'error_during_execution', is_error: true, errors: ['[ede_diagnostic] result_type=user'] };
  });
  agent.start('lang', '.', undefined);
  await tick();
  agent.stop();
  await tick();
  await tick();
  assert.deepEqual(closing(), [{ state: 'idle', text: 'Nikki stoppte.' }]);
  assert.equal(agent.busy(), false);
});

test('stop: a CLI that ignores interrupt is aborted after killAfterMs (M5)', async () => {
  let aborted = false;
  const { agent, closing } = setup(async function* (ctl) {
    yield init;
    await new Promise((_, reject) =>
      ctl.signal.addEventListener('abort', () => {
        aborted = true;
        reject(new Error('aborted'));
      }),
    );
  });
  agent.start('hängt', '.', undefined);
  await tick();
  agent.stop();
  assert.equal(aborted, false);
  await new Promise((r) => setTimeout(r, 40));
  assert.equal(aborted, true);
  assert.deepEqual(closing(), [{ state: 'idle', text: 'Nikki stoppte.' }]);
});
