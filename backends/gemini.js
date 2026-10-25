// Runs one task through the Gemini CLI (Google login / optional GEMINI_API_KEY in the user's env).
// Headless: `gemini -p … --output-format stream-json`. Tools auto-approved in companion YOLO for parity with Cursor flow.
import { spawn } from 'node:child_process';
import readline from 'node:readline';
import { findGemini } from '../lib/gemini-path.js';

function killTree(proc) {
  if (!proc?.pid) return;
  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(proc.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
    } else {
      proc.kill('SIGTERM');
    }
  } catch {
    try {
      proc.kill();
    } catch {}
  }
}

/** Spawn without `shell:true` so prompt chars (& | > ") are not reinterpreted by cmd.exe. */
function spawnGemini(bin, args, opts) {
  if (process.platform === 'win32' && /\.cmd$/i.test(bin)) {
    return spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', bin, ...args.map(String)], {
      ...opts,
      shell: false,
      windowsHide: true,
    });
  }
  return spawn(bin, args, { ...opts, shell: false, windowsHide: true });
}

export function createGeminiAgent({ onStatus, onSession, findBin = findGemini }) {
  let child = null;
  let busy = false;
  let stopped = false;

  async function start(prompt, cwd, resume, { model } = {}) {
    if (busy) return;
    const bin = findBin();
    if (!bin) {
      onStatus({
        state: 'error',
        text: 'Nikki braucht Gemini.',
        answer:
          'Installier die Gemini CLI (`npm i -g @google/gemini-cli`) und melde dich einmal mit „gemini“ an (Google-Login oder AI-Studio-Key). Danach geht Chat hier.',
      });
      return;
    }

    busy = true;
    stopped = false;
    onStatus({ state: 'thinking', text: 'Nikki startet…' });

    const args = ['-p', prompt, '--output-format', 'stream-json'];
    if (model) args.push('--model', model);
    // unattended tool use in the notch; user already chose Chat intentionally
    args.push('--yolo');
    if (resume) args.push('--resume', resume);

    let answer = '';
    let sessionId = null;

    try {
      if (stopped) {
        onStatus({ state: 'idle', text: 'Nikki stoppte.' });
        return;
      }
      child = spawnGemini(bin, args, {
        cwd,
        env: { ...process.env, DESKTOPCOMPANION_AGENT: '1' },
      });

      const rl = readline.createInterface({ input: child.stdout });
      rl.on('line', (line) => {
        if (stopped) return;
        let ev;
        try {
          ev = JSON.parse(line);
        } catch {
          return;
        }
        const type = ev.type || ev.event || ev.kind;
        if (type === 'init' || ev.session_id) {
          sessionId = ev.session_id || ev.sessionId || sessionId;
          if (sessionId) onSession(sessionId);
          if (ev.model) onStatus({ state: 'thinking', text: 'Nikki denkt…', model: ev.model });
          return;
        }
        if (type === 'message' || type === 'assistant' || ev.role === 'assistant') {
          const chunk = ev.content ?? ev.text ?? ev.delta ?? ev.message ?? '';
          const text = typeof chunk === 'string' ? chunk : chunk?.text || '';
          if (text) {
            answer += text;
            onStatus({ state: 'working', text: 'Nikki schreibt…', answer });
          }
          return;
        }
        if (type === 'tool_use' || type === 'tool_call') {
          onStatus({ state: 'working', text: 'Nikki arbeitet…' });
          return;
        }
        if (type === 'result' || type === 'response') {
          const final = ev.response ?? ev.result ?? ev.content ?? answer;
          if (typeof final === 'string' && final) answer = final;
          return;
        }
        if (type === 'error' && ev.message) {
          onStatus({ state: 'error', text: 'Nikki stolpert.', answer: String(ev.message) });
        }
      });

      let errBuf = '';
      child.stderr?.on('data', (d) => {
        errBuf += d.toString();
      });

      const code = await new Promise((resolve) => {
        child.on('error', (e) => {
          errBuf += e.message;
          resolve(1);
        });
        child.on('close', (c) => resolve(c ?? 1));
      });

      if (stopped) {
        onStatus({ state: 'idle', text: 'Nikki stoppte.', answer });
        return;
      }
      if (code === 0) {
        onStatus({ state: 'done', text: 'Nikki ist fertig.', answer: answer || 'Fertig.' });
      } else {
        const hint = errBuf.trim().slice(0, 800) || `gemini beendete mit Code ${code}`;
        onStatus({
          state: 'error',
          text: 'Nikki stolpert.',
          answer: answer ? `${answer}\n\n${hint}` : hint,
        });
      }
    } catch (e) {
      if (!stopped) onStatus({ state: 'error', text: 'Nikki stolpert.', answer: e.message || String(e) });
    } finally {
      child = null;
      busy = false;
    }
  }

  function stop() {
    stopped = true;
    killTree(child);
  }

  return { start, stop, busy: () => busy };
}
