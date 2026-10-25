// Runs one task at a time through the installed, logged-in Claude Code CLI via the Agent SDK.
import { query } from '@anthropic-ai/claude-agent-sdk';
import { toAnswers, toStatus } from '../lib/status.js';

// shortcut: mismatch is warn-only (no hard fail). ceiling: wrong SDK/CLI pair may break tools. upgrade: when canUseTool/stream fails after a CLI bump, pin both to matching patch and fail start.
const TESTED_CLI = '2.1.308';

export function createClaudeAgent({ claudePath, onStatus, onSession, askPermission }) {
  let current = null;
  let stopped = false;

  async function start(prompt, cwd, resume, { plan = false, model } = {}) {
    if (current) return;
    stopped = false;
    current = query({
      prompt,
      options: {
        cwd,
        resume,
        pathToClaudeCodeExecutable: claudePath,
        model,
        permissionMode: plan ? 'plan' : 'acceptEdits',
        env: { ...process.env, DESKTOPCOMPANION_AGENT: '1' }, // hook.cjs skips our own sessions: they report through the SDK
        canUseTool: async (toolName, input, { signal, suggestions, title }) => {
          const { answer, picks, message } = await askPermission({ toolName, input, title }, signal);
          if (answer === 'deny') return { behavior: 'deny', message: message || 'Vom Nutzer im Companion abgelehnt.' };
          if (toolName === 'AskUserQuestion') return { behavior: 'allow', updatedInput: { ...input, answers: toAnswers(input.questions, picks) } };
          // an approved plan is carried out like any other task: edits allowed, the rest asks
          if (toolName === 'ExitPlanMode') return { behavior: 'allow', updatedInput: input, updatedPermissions: [{ type: 'setMode', mode: 'acceptEdits', destination: 'session' }] };
          return { behavior: 'allow', updatedInput: input, ...(answer === 'always' && { updatedPermissions: suggestions }) };
        },
      },
    });
    try {
      for await (const m of current) {
        if (m.type === 'system' && m.subtype === 'init') {
          onSession(m.session_id);
          if (m.claude_code_version !== TESTED_CLI) console.warn(`claude ${m.claude_code_version} ungetestet (getestet: ${TESTED_CLI})`);
        }
        const s = toStatus(m);
        if (s) onStatus(s);
      }
    } catch (e) {
      // interrupt() ends the stream by throwing, not with a result message
      onStatus(stopped ? { state: 'idle', text: 'Nikki stoppte.' } : { state: 'error', text: 'Nikki stolpert.', answer: e.message });
    } finally {
      current = null;
    }
  }

  function stop() {
    if (!current) return;
    stopped = true;
    current.interrupt().catch(() => {});
  }

  return { start, stop, busy: () => !!current };
}
