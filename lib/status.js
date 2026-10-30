// Maps one Agent SDK message to what the companion shows: { state, text, answer? }.
// States: thinking | working | done | error. Returns null for messages that change nothing.
import path from 'node:path';

const short = (s, n = 22) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
const file = (input) => path.basename(String(input.file_path ?? input.notebook_path ?? input.path ?? ''));

export function describeTool(name, input = {}) {
  switch (name) {
    case 'Read':
      return `Nikki liest ${short(file(input), 18)}…`;
    case 'Edit':
    case 'MultiEdit':
    case 'Write':
    case 'NotebookEdit':
      return `Nikki tippt ${short(file(input), 18)}…`;
    case 'Bash':
    case 'Shell':
    case 'PowerShell': {
      const cmd = short(String(input.command ?? '').split('\n')[0], 16);
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

function eventStatus(e) {
  switch (e.hook_event_name) {
    case 'SessionStart':
      // observed terminal sessions: show as alive, not notch-idle (idle never overrides the bar)
      return { state: 'thinking', text: 'Nikki schaut zu…' };
    case 'UserPromptSubmit':
      return { state: 'thinking', text: 'Nikki denkt…' };
    case 'PreToolUse':
      if (e.tool_name === 'AskUserQuestion') return { state: 'needsYou', text: question(e.tool_input) };
      if (e.tool_name === 'ExitPlanMode') return { state: 'needsYou', text: 'Nikki zeigt Plan!' };
      return { state: 'working', text: describeTool(e.tool_name, e.tool_input) };
    case 'PermissionRequest':
      return { state: 'needsYou', text: 'Nikki will OK!' };
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

// Maps one Claude Code hook event from a terminal session to { state, text }, given the session's previous status.
// Returns null for events that change nothing. Hooks run async, so their events can arrive slightly out of order.
export function hookToStatus(e, prev) {
  const s = eventStatus(e);
  if (!s || prev?.state !== 'needsYou') return s;
  // a PreToolUse racing the permission prompt must not hide it; the answer shows up as PostToolUse
  if (s.state === 'working' && e.hook_event_name === 'PreToolUse') return null;
  // one prompt, several events (PermissionRequest + Notification): keep the specific text
  if (s.state === 'needsYou' && s.text === 'Nikki braucht dich!') return { ...s, text: prev.text };
  return s;
}
