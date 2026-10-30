// Runs one task at a time through the installed, logged-in Claude Code CLI via the Agent SDK.
import { query as sdkQuery } from '@anthropic-ai/claude-agent-sdk';
import { toAnswers, toStatus } from '../lib/status.js';

// shortcut: mismatch is warn-only (no hard fail). ceiling: wrong SDK/CLI pair may break tools. upgrade: when canUseTool/stream fails after a CLI bump, pin both to matching patch and fail start.
const TESTED_CLI = '2.1.308';
const STOPPED = { state: 'idle', text: 'Nikki stoppte.' };

// Every turn ends with exactly one closing status (done | error | idle), whatever the CLI does (H4).
// query is injectable for tests; killAfterMs: how long stop() waits for interrupt() before it aborts the CLI.
export function createClaudeAgent({ claudePath, onStatus, onSession, askPermission, query = sdkQuery, killAfterMs = 3000 }) {
  let run = null; // the turn whose CLI is still running: { q, abort, stopped, finished, timer }
  let queued = null; // a prompt sent after "done" while that CLI was still exiting (B4); it starts right after
  let warned = false;

  async function go(prompt, cwd, resume, { plan = false, model } = {}) {
    const r = (run = { q: null, abort: new AbortController(), stopped: false, finished: false, timer: null });
    const close = (s) => {
      if (r.finished) return;
      r.finished = true;
      onStatus(s);
    };
    const fail = (why) => close(r.stopped ? STOPPED : { state: 'error', text: 'Nikki stolpert.', answer: why });
    try {
      r.q = query({
        prompt,
        options: {
          cwd,
          resume,
          pathToClaudeCodeExecutable: claudePath,
          model,
          abortController: r.abort,
          permissionMode: plan ? 'plan' : 'acceptEdits',
          env: { ...process.env, DESKTOPCOMPANION_AGENT: '1' }, // hook.cjs skips our own sessions: they report through the SDK
          canUseTool: async (toolName, input, { signal, suggestions, title }) => {
            const { answer, picks, message, interrupt } = await askPermission({ toolName, input, title }, signal);
            if (answer === 'deny') {
              // interrupt: the user's reason comes next as their own prompt (B7), so this turn ends as stopped, not as an error
              if (interrupt) r.stopped = true;
              return { behavior: 'deny', message: message || 'Vom Nutzer im Companion abgelehnt.', ...(interrupt && { interrupt: true }) };
            }
            if (toolName === 'AskUserQuestion') return { behavior: 'allow', updatedInput: { ...input, answers: toAnswers(input.questions, picks) } };
            // an approved plan is carried out like any other task: edits allowed, the rest asks
            if (toolName === 'ExitPlanMode') return { behavior: 'allow', updatedInput: input, updatedPermissions: [{ type: 'setMode', mode: 'acceptEdits', destination: 'session' }] };
            return { behavior: 'allow', updatedInput: input, ...(answer === 'always' && { updatedPermissions: suggestions }) };
          },
        },
      });
      for await (const m of r.q) {
        if (m.type === 'system' && m.subtype === 'init') {
          onSession(m.session_id);
          if (m.claude_code_version !== TESTED_CLI && !warned) console.warn(`claude ${m.claude_code_version} ungetestet (getestet: ${TESTED_CLI})`);
          warned = true;
        }
        if (r.finished) continue; // the CLI is winding down after its result
        // after stop the CLI may still answer with an error result: that is a stop, not a stumble (B5)
        if (m.type === 'result' && r.stopped) {
          close(STOPPED);
          continue;
        }
        const s = toStatus(m);
        if (s?.state === 'done' || s?.state === 'error') close(s);
        else if (s) onStatus(s);
      }
      fail('Agent beendet ohne Ergebnis.');
    } catch (e) {
      fail(e?.message ?? String(e)); // interrupt/abort end the stream by throwing; query() itself may throw too
    } finally {
      clearTimeout(r.timer);
      run = null;
      const next = queued;
      queued = null;
      if (next) go(...next);
    }
  }

  function start(prompt, cwd, resume, opts) {
    if (busy()) return false;
    if (run) queued = [prompt, cwd, resume, opts];
    else go(prompt, cwd, resume, opts);
    return true;
  }

  function stop() {
    if (queued) {
      queued = null; // it never started; the old CLI just finishes exiting
      onStatus(STOPPED);
      return;
    }
    const r = run;
    if (!r || r.finished || r.stopped) return;
    r.stopped = true;
    Promise.resolve()
      .then(() => r.q?.interrupt())
      .catch(() => {});
    r.timer = setTimeout(() => r.abort.abort(), killAfterMs); // a hanging CLI must not keep the island busy (M5)
  }

  // app quits: no waiting for interrupt, the CLI must not outlive Nikki
  function abort() {
    queued = null;
    if (run) run.stopped = true;
    run?.abort.abort();
  }

  const busy = () => !!queued || (!!run && !run.finished);
  return { start, stop, abort, busy };
}
