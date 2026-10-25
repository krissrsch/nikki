// Hook forwarder for Claude Code and Cursor: stdin JSON → POST to the running companion.
// Silent no-op when the app is down. Cursor hooks always get a schema-valid allow/continue (observe only).
// Usage: node hook.cjs <path to hook.json with { port, token }>
const fs = require('node:fs');
const http = require('node:http');

if (process.env.DESKTOPCOMPANION_AGENT) {
  // Own ACP/SDK sessions already report status in-app. Reply immediately — waiting for
  // stdin 'end' stalls afterAgentThought/stop and triggers Cursor's WritableIterable bug.
  process.stdin.resume();
  process.stdin.on('data', () => {});
  try {
    process.stdout.write(JSON.stringify({ permission: 'allow', continue: true }) + '\n');
  } catch {}
  process.exit(0);
} else {

const EVENT_MAP = {
  sessionStart: 'SessionStart',
  sessionEnd: 'SessionEnd',
  beforeSubmitPrompt: 'UserPromptSubmit',
  preToolUse: 'PreToolUse',
  postToolUse: 'PostToolUse',
  postToolUseFailure: 'PostToolUse',
  stop: 'Stop',
  // afterAgentResponse is mid-turn on Cursor (tools may follow) — do not map to Stop/done toasts
  // afterAgentThought intentionally not registered (Cursor ACP WritableIterable bug)
  beforeShellExecution: 'PreToolUse',
  afterShellExecution: 'PostToolUse',
  beforeMCPExecution: 'PreToolUse',
  afterMCPExecution: 'PostToolUse',
  afterFileEdit: 'PostToolUse',
  beforeReadFile: 'PreToolUse',
};

function cursorReply(raw) {
  const name = raw.hook_event_name || '';
  if (name === 'beforeSubmitPrompt') return { continue: true };
  if (
    name === 'preToolUse' ||
    name === 'beforeShellExecution' ||
    name === 'beforeMCPExecution' ||
    name === 'beforeReadFile' ||
    name === 'subagentStart'
  ) {
    return { permission: 'allow' };
  }
  return {};
}

function normalize(raw) {
  const name = raw.hook_event_name || '';
  const mapped = EVENT_MAP[name] || name;
  const session_id = String(
    raw.session_id || raw.conversation_id || raw.generation_id || '',
  ).trim();
  const cwd =
    raw.cwd ||
    raw.tool_input?.working_directory ||
    (Array.isArray(raw.workspace_roots) ? raw.workspace_roots[0] : '') ||
    '';
  const tool_name = raw.tool_name || (name === 'beforeShellExecution' ? 'Shell' : raw.tool_name);
  const tool_input =
    raw.tool_input ||
    (name === 'beforeShellExecution' ? { command: raw.command || raw.tool_input?.command } : raw.tool_input);
  return {
    ...raw,
    hook_event_name: mapped,
    session_id: session_id || undefined,
    cwd,
    tool_name,
    tool_input,
    source: EVENT_MAP[name] || raw.conversation_id != null || raw.cursor_version != null ? 'cursor' : 'claude',
  };
}

let body = '';
process.stdin.on('data', (d) => (body += d));
process.stdin.on('end', () => {
  let raw = {};
  try {
    raw = JSON.parse(body || '{}');
  } catch {}
  const isCursor = !!EVENT_MAP[raw.hook_event_name] || raw.conversation_id != null || raw.cursor_version != null;
  // Always answer Cursor first so we never stall the agent loop.
  if (isCursor) {
    try {
      process.stdout.write(JSON.stringify(cursorReply(raw)) + '\n');
    } catch {}
  }

  let cfg;
  try {
    cfg = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  } catch {
    return;
  }
  const payload = JSON.stringify(normalize(raw));
  const req = http.request(
    {
      host: '127.0.0.1',
      port: cfg.port,
      path: '/hook',
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-token': cfg.token, 'content-length': Buffer.byteLength(payload) },
      timeout: 1000,
    },
    () => {},
  );
  req.on('error', () => {});
  req.on('timeout', () => req.destroy());
  req.end(payload);
});

} // end !DESKTOPCOMPANION_AGENT
