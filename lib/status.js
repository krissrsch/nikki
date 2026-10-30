// Maps one Agent SDK message to what the companion shows: { state, text, answer? }.
// States: thinking | working | done | error. Returns null for messages that change nothing.
import path from 'node:path';

const short = (s, n = 22) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
const file = (input) => path.basename(String(input.file_path ?? input.notebook_path ?? input.path ?? ''));

export function describeTool(name, input = {}) {
  switch (name) {
    case 'Read':
      return `Nikki liest ${file(input).slice(0, 18)}…`; // the trailing … also marks a cut name: never two (B16)
    case 'Edit':
    case 'MultiEdit':
    case 'Write':
    case 'NotebookEdit':
      return `Nikki tippt ${file(input).slice(0, 18)}…`;
    case 'Bash':
    case 'Shell':
    case 'PowerShell': {
      const cmd = String(input.command ?? '').split('\n')[0].slice(0, 16);
      return cmd ? `Nikki: ${cmd}…` : 'Nikki im Terminal…';
    }
    case 'Grep':
    case 'Glob':
      return 'Nikki sucht…';
    case 'WebFetch':
    case 'WebSearch':
      return 'Nikki googelt…';
    case 'Task':
    case 'Agent':
      return 'Nikki holt Hilfe…';
    case 'TodoWrite':
      return 'Nikki plant…';
    case 'AskUserQuestion':
      return 'Nikki fragt…';
    case 'ExitPlanMode':
      return 'Nikki zeigt Plan…';
    default:
      return 'Nikki arbeitet…';
  }
}

export function toStatus(m) {
  if (m.type === 'system' && m.subtype === 'init') return { state: 'thinking', text: 'Nikki denkt…', model: m.model };
  if (m.type === 'assistant') {
    const tool = m.message?.content?.findLast?.((b) => b.type === 'tool_use');
    return tool ? { state: 'working', text: describeTool(tool.name, tool.input) } : { state: 'thinking', text: 'Nikki denkt…' };
  }
  if (m.type === 'result') {
    if (m.subtype === 'success' && !m.is_error) return { state: 'done', text: 'Nikki ist fertig.', answer: m.result ?? '' };
    // || not ??: an empty errors[] must still say why (N1); CLI-internal [ede_diagnostic] lines are no reason (B5)
    const errors = (m.errors ?? []).filter((e) => !String(e).startsWith('[ede_diagnostic]')).join('\n');
    return { state: 'error', text: 'Nikki stolpert.', answer: m.result || errors || m.subtype };
  }
  return null;
}

// AskUserQuestion answers in the SDK's format: question text -> chosen label(s), multi-select comma-separated.
export const toAnswers = (questions, picks) => Object.fromEntries(questions.map((q, i) => [q.question, (picks[i] ?? []).join(', ')]));

// Short pick line for the notch / step line, e.g. "Nikki: Tee oder Kaffee?"
function question(input = {}) {
  const [q, ...more] = input.questions ?? [];
  if (!q) return 'Nikki fragt dich!';
  const opts = (q.options ?? []).map((o) => o.label).filter(Boolean);
  const head = short(String(q.question || '').replace(/\?$/, ''), 28);
  if (opts.length) {
    const moreMark = more.length || opts.length > 3 ? ' …' : '';
    return `Nikki: ${head}? (${opts.slice(0, 3).join(' / ')}${moreMark})`;
  }
  return `Nikki: ${head}?`;
}
const WAITS = new Set(['permission_prompt', 'elicitation_dialog', 'agent_needs_input']);
const VAGUE = new Set(['Nikki braucht dich!', 'Nikki fragt dich!']); // says less than what an earlier event of the same prompt said
// a terminal session that is open but has nothing to show: the bar ignores it
export const QUIET = { state: 'idle', text: 'Nikki schaut zu.' };

function eventStatus(e) {
  switch (e.hook_event_name) {
    case 'SessionStart':
      return QUIET; // an untouched `claude` is not busy (M4)
    case 'UserPromptSubmit':
      return { state: 'thinking', text: 'Nikki denkt…' };
    case 'PreToolUse':
      if (e.tool_name === 'AskUserQuestion') return { state: 'needsYou', text: question(e.tool_input), tool: e.tool_name };
      if (e.tool_name === 'ExitPlanMode') return { state: 'needsYou', text: 'Nikki zeigt Plan!', tool: e.tool_name };
      return { state: 'working', text: describeTool(e.tool_name, e.tool_input) };
    case 'PermissionRequest': {
      // questions and plans also come through here: keep saying what Claude asks (M2)
      const text = e.tool_name === 'AskUserQuestion' ? question(e.tool_input) : e.tool_name === 'ExitPlanMode' ? 'Nikki zeigt Plan!' : 'Nikki will OK!';
      return { state: 'needsYou', text, tool: e.tool_name };
    }
    case 'PostToolUse':
      return { state: 'working', text: ['AskUserQuestion', 'ExitPlanMode'].includes(e.tool_name) ? 'Nikki macht weiter…' : describeTool(e.tool_name, e.tool_input) };
    case 'Notification':
      return WAITS.has(e.notification_type) ? { state: 'needsYou', text: 'Nikki braucht dich!' } : null;
    case 'Stop':
      return { state: 'done', text: 'Nikki ist fertig.' };
    default:
      return null;
  }
}

// Maps one Claude Code hook event from a terminal session to { state, text, tool? }, given the session's previous status.
// Returns null for events that change nothing. Hooks run async, so their events can arrive slightly out of order.
// A waiting session (needsYou, tool = what it waits for) is let go only by that tool's PostToolUse, a new prompt or
// question, Stop, UserPromptSubmit, or the idle_prompt Claude sends after 60 s at the prompt.
export function hookToStatus(e, prev) {
  if (prev?.state === 'needsYou' && e.hook_event_name === 'Notification' && e.notification_type === 'idle_prompt') return QUIET; // denied in the terminal: no PostToolUse, no Stop (M3)
  const s = eventStatus(e);
  if (!s || prev?.state !== 'needsYou') return s;
  // a PreToolUse racing the permission prompt must not hide it; the answer shows up as PostToolUse
  if (s.state === 'working' && e.hook_event_name === 'PreToolUse') return null;
  // a parallel tool (Read next to the Bash that asks) finishing late must not hide it either (M1)
  if (e.hook_event_name === 'PostToolUse' && e.tool_name !== prev.tool) return null;
  // one prompt, several events (PermissionRequest + Notification): keep the specific text
  if (s.state === 'needsYou' && VAGUE.has(s.text)) return { ...prev, ...s, text: prev.text };
  return s;
}
