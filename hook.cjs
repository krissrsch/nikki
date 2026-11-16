// Hook forwarder for Claude Code: stdin JSON → POST to the running companion. Silent no-op when the app is down.
// Usage: node hook.cjs <path to hook.json with { port, token }> [--wait | --stop] --nikki-hook
// --wait (PermissionRequest only): long-poll the island for the answer and print Claude Code's decision JSON.
// --stop (Stop only): ask the island for a message queued for this session; if there is one, Claude keeps working with it.
// No answer (app down, timeout, answered in the terminal) prints nothing, so the terminal decides as usual (fail-open).
const fs = require('node:fs');
const http = require('node:http');

const cut = (s, n) => (typeof s === 'string' ? s.slice(0, n) : undefined);

// Only what the island shows, cut short: tool output and file contents never leave the terminal,
// and the event always fits the server's size limit (M10).
// A card that asks for approval shows the whole command: a harmless start with something else after the cut must
// never be approved unseen. Longer commands are not relayed at all; the terminal shows them in full.
const CMD_SHOWN = 200;
const CMD_APPROVE = 8000;
function slim(raw, { cmdMax = CMD_SHOWN } = {}) {
  const i = raw?.tool_input ?? {};
  const questions = Array.isArray(i.questions)
    ? i.questions.slice(0, 4).map((q) => ({
        question: cut(q?.question, 200),
        // labels stay whole enough to be sent back as the answer
        options: (Array.isArray(q?.options) ? q.options : []).slice(0, 6).map((o) => ({ label: cut(o?.label, 200) })),
      }))
    : undefined;
  return {
    hook_event_name: cut(raw?.hook_event_name, 60),
    session_id: cut(raw?.session_id, 100),
    cwd: cut(raw?.cwd, 1000),
    tool_name: cut(raw?.tool_name, 200),
    notification_type: cut(raw?.notification_type, 60),
    last_assistant_message: cut(raw?.last_assistant_message, 4000), // Stop: Claude's answer, shown under the session in the chat
    tool_input: { file_path: cut(i.file_path, 1000), notebook_path: cut(i.notebook_path, 1000), path: cut(i.path, 1000), command: cut(i.command, cmdMax), questions },
  };
}
// What "Always" would add, in words the card can show, so the user sees how far the approval reaches.
function describeRules(suggestions) {
  const out = [];
  for (const s of Array.isArray(suggestions) ? suggestions : []) {
    if (Array.isArray(s?.rules))
      for (const r of s.rules) out.push(r?.ruleContent ? `${r.toolName}(${r.ruleContent})` : String(r?.toolName ?? '?'));
    else if (s?.type === 'setMode') out.push(`Modus: ${s.mode}`);
    else if (Array.isArray(s?.directories)) out.push(`Ordner: ${s.directories.join(', ')}`);
    else out.push(String(s?.type ?? '?'));
  }
  return out.slice(0, 10).map((x) => cut(x, 300));
}
// The island's answer → Claude Code's PermissionRequest decision, or null (stay silent, the terminal decides).
// reply: { answer: 'allow' | 'always' | 'deny', message?, picks?: string[][] (one label list per question) }
function decision(raw, reply) {
  const out = (d) => ({ hookSpecificOutput: { hookEventName: 'PermissionRequest', decision: d } });
  if (reply?.answer === 'deny') return out({ behavior: 'deny', message: String(reply.message || 'Abgelehnt in Nikki.') });
  if (reply?.answer !== 'allow' && reply?.answer !== 'always') return null;
  const d = { behavior: 'allow' };
  // a question's picks travel back inside the tool input, keyed by the full question text (the island only saw it cut)
  if (Array.isArray(reply.picks)) {
    const questions = Array.isArray(raw?.tool_input?.questions) ? raw.tool_input.questions : [];
    const answers = Object.fromEntries(questions.map((q, i) => [q?.question, (Array.isArray(reply.picks[i]) ? reply.picks[i] : []).join(', ')]));
    d.updatedInput = { ...(raw?.tool_input ?? {}), answers };
  }
  if (reply.answer === 'always' && Array.isArray(raw?.permission_suggestions) && raw.permission_suggestions.length)
    d.updatedPermissions = raw.permission_suggestions;
  return out(d);
}
// A message queued in the island for a finished turn → Stop "block": Claude continues with it as the reason.
function stopDecision(reply) {
  const text = typeof reply?.message === 'string' ? reply.message.trim() : '';
  return text ? { decision: 'block', reason: `Nachricht des Nutzers aus Nikki: ${text}` } : null;
}
module.exports = { slim, decision, stopDecision, describeRules, CMD_APPROVE };

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
  const stop = process.argv.includes('--stop');
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
    if (stop)
      // never holds the session up: no queued message or no app within 1.5 s means Claude simply stops
      return post(cfg, '/hook/stop', JSON.stringify(event), 1500, (text) => {
        let reply = null;
        try {
          reply = text ? JSON.parse(text) : null;
        } catch {}
        const d = stopDecision(reply);
        if (d) process.stdout.write(JSON.stringify(d));
        process.exit(0);
      });
    const command = raw?.tool_input?.command;
    // too long to show whole on the card: only observe it, so the terminal asks with the full text
    if (!wait || (typeof command === 'string' && command.length > CMD_APPROVE))
      return post(cfg, '/hook', JSON.stringify(event), 1000, () => process.exit(0));
    // the island shows the rules "Immer" would add; the rules themselves stay here and go back unchanged
    const payload = JSON.stringify({ ...slim(raw, { cmdMax: CMD_APPROVE }), always_rules: describeRules(raw.permission_suggestions) });
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
