// Hook forwarder for Claude Code: stdin JSON → POST to the running companion. Silent no-op when the app is down.
// Usage: node hook.cjs <path to hook.json with { port, token }> --nikki-hook
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
module.exports = { slim };

// Own SDK sessions already report status in-app.
if (require.main === module && !process.env.DESKTOPCOMPANION_AGENT) {
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
    const payload = JSON.stringify(slim(raw));
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
}
