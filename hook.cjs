// Hook forwarder for Claude Code: stdin JSON → POST to the running companion. Silent no-op when the app is down.
// Usage: node hook.cjs <path to hook.json with { port, token }>
const fs = require('node:fs');
const http = require('node:http');

// Own SDK sessions already report status in-app.
if (process.env.DESKTOPCOMPANION_AGENT) process.exit(0);

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
  const payload = JSON.stringify(raw);
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
