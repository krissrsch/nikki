// Hook forwarder for Claude Code: stdin JSON → POST to the running companion. Silent no-op when the app is down.
// Usage: node hook.cjs <path to hook.json with { port, token }> [--wait] --nikki-hook
// --wait (PermissionRequest only): long-poll the island for the answer and print Claude Code's decision JSON.
// No answer (app down, timeout, answered in the terminal) prints nothing, so the terminal dialog decides (fail-open).
const fs = require('node:fs');
const http = require('node:http');

const cut = (s, n) => (typeof s === 'string' ? s.slice(0, n) : undefined);

// Only what the island shows, cut short: tool output and file contents never leave the terminal,
// and the event always fits the server's size limit (M10).
function slim(raw) {
  const i = raw?.tool_input ?? {};
  const questions = Array.isArray(i.questions)
    ? i.questions.slice(0, 4).map((q) => ({
        question: cut(q?.question, 200),
        options: (Array.isArray(q?.options) ? q.options : []).slice(0, 6).map((o) => ({ label: cut(o?.label, 80) })),
      }))
    : undefined;
  return {
    hook_event_name: cut(raw?.hook_event_name, 60),
    session_id: cut(raw?.session_id, 100),
    cwd: cut(raw?.cwd, 1000),
    tool_name: cut(raw?.tool_name, 200),
    notification_type: cut(raw?.notification_type, 60),
    tool_input: { file_path: cut(i.file_path, 1000), notebook_path: cut(i.notebook_path, 1000), path: cut(i.path, 1000), command: cut(i.command, 200), questions },
  };
}
// The island's answer → Claude Code's PermissionRequest decision, or null (stay silent, the terminal decides).
// reply: { answer: 'allow' | 'always' | 'deny', message?, answers?: { [question]: label } }
function decision(raw, reply) {
  const out = (d) => ({ hookSpecificOutput: { hookEventName: 'PermissionRequest', decision: d } });
  if (reply?.answer === 'deny') return out({ behavior: 'deny', message: String(reply.message || 'Abgelehnt in Nikki.') });
  if (reply?.answer !== 'allow' && reply?.answer !== 'always') return null;
  const d = { behavior: 'allow' };
  // a question's picks travel back inside the tool input, next to the questions they answer
  if (reply.answers && typeof reply.answers === 'object') d.updatedInput = { ...(raw?.tool_input ?? {}), answers: reply.answers };
  if (reply.answer === 'always' && Array.isArray(raw?.permission_suggestions) && raw.permission_suggestions.length)
    d.updatedPermissions = raw.permission_suggestions;
  return out(d);
}
module.exports = { slim, decision };

const WAIT_MS = 110_000; // below the hook's own timeout (120 s, lib/hooks.js), so we always end cleanly first

function post(cfg, route, payload, timeout, done) {
  const req = http.request(
    {
      host: '127.0.0.1',
      port: cfg.port,
      path: route,
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-token': cfg.token, 'content-length': Buffer.byteLength(payload) },
      timeout,
    },
    (res) => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', (d) => (text += d));
      res.on('end', () => done(res.statusCode === 200 ? text : ''));
    },
  );
  req.on('error', () => done(''));
  req.on('timeout', () => req.destroy());
  req.end(payload);
}

// Own SDK sessions already report status in-app (and canUseTool answers their permissions).
if (require.main === module && !process.env.DESKTOPCOMPANION_AGENT) {
  const wait = process.argv.includes('--wait');
  let body = '';
  process.stdin.on('data', (d) => (body += d));
  process.stdin.on('end', () => {
    let raw = {};
    try {
      raw = JSON.parse(body || '{}');
    } catch {}
    let cfg;
    try {
      cfg = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
    } catch {
      return;
    }
    const event = slim(raw);
    if (!wait) return post(cfg, '/hook', JSON.stringify(event), 1000, () => {});
    // the island needs the suggestion count to offer "Immer"; the rules themselves stay here
    const payload = JSON.stringify({ ...event, can_always: Array.isArray(raw.permission_suggestions) && raw.permission_suggestions.length > 0 });
    post(cfg, '/hook/wait', payload, WAIT_MS, (text) => {
      let reply = null;
      try {
        reply = text ? JSON.parse(text) : null;
      } catch {}
      const d = decision(raw, reply);
      if (d) process.stdout.write(JSON.stringify(d));
      process.exit(0);
    });
  });
}
