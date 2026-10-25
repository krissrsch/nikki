// Minimal ACP (Agent Client Protocol) JSON-RPC client over stdio for `agent acp`.
import { spawn } from 'node:child_process';
import readline from 'node:readline';

export function createAcpClient({ node, index, onNotification, onRequest, env = process.env, args = ['acp'] }) {
  const child = spawn(node, [index, ...args], {
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
    env: { ...env },
  });
  child.stderr?.on('data', () => {}); // keep the pipe draining; product logs go through status

  let nextId = 1;
  const pending = new Map();
  let closed = false;

  function failPending(err) {
    closed = true;
    for (const [, w] of pending) w.reject(err);
    pending.clear();
  }

  function write(obj) {
    if (closed || !child.stdin?.writable) return false;
    try {
      child.stdin.write(JSON.stringify(obj) + '\n');
      return true;
    } catch {
      return false;
    }
  }

  function request(method, params) {
    if (closed) return Promise.reject(new Error('ACP process exited'));
    const id = nextId++;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      if (!write({ jsonrpc: '2.0', id, method, params })) {
        pending.delete(id);
        reject(new Error('ACP process exited'));
      }
    });
  }

  function respond(id, result) {
    write({ jsonrpc: '2.0', id, result });
  }

  function respondError(id, error) {
    write({ jsonrpc: '2.0', id, error });
  }

  const rl = readline.createInterface({ input: child.stdout });
  rl.on('line', (line) => {
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      return;
    }
    if (msg.id != null && (msg.result !== undefined || msg.error)) {
      const w = pending.get(msg.id);
      if (!w) return;
      pending.delete(msg.id);
      msg.error ? w.reject(msg.error) : w.resolve(msg.result);
      return;
    }
    if (msg.method && msg.id != null) {
      Promise.resolve(onRequest?.(msg.method, msg.params ?? {}, msg.id))
        .then((result) => {
          // Always reply — an unanswered ACP request hangs the agent forever
          if (result !== undefined) respond(msg.id, result);
          else respondError(msg.id, { code: -32601, message: `Unhandled: ${msg.method}` });
        })
        .catch((e) => respondError(msg.id, { code: -32000, message: String(e?.message ?? e) }));
      return;
    }
    if (msg.method) onNotification?.(msg.method, msg.params ?? {});
  });

  child.on('error', (e) => failPending(e instanceof Error ? e : new Error(String(e))));
  child.on('exit', () => failPending(new Error('ACP process exited')));

  function close() {
    if (closed) return;
    closed = true;
    failPending(new Error('ACP process exited'));
    try {
      child.stdin.end();
    } catch {}
    try {
      child.kill();
    } catch {}
  }

  return { request, respond, close, child, get closed() { return closed; } };
}
