// Paw module: asks Pawprint, the local search over the user's past Claude Code chats (https://github.com/krissrsch/pawprint).
// Pawprint runs as a small server on 127.0.0.1 (`pawprint serve`). Nikki starts it with the first question, talks to it with a
// token only the two of them know (passed in the environment, not on the command line), and stops it after a while without
// questions: its search models need a few GB of memory. If Nikki dies, the server notices (--parent-pid) and exits as well.
import path from 'node:path';

const MAX_QUESTION = 500;
const PAW_EXE = ['pawprint.exe']; // node starts an .exe directly; a .cmd or .bat would need a shell

// Where pawprint.exe is: the path the user picked, the path Pawprint left in ~/.pawprint/pawprint-path.txt when it last ran,
// a folder on PATH, or the dev layout (../pawprint/.venv/Scripts next to this app).
// Only existing files named pawprint.exe count; `exists` is fs.existsSync, injectable for the tests.
export function findPawprint({ stored, recorded, env = '', dir = '', exists }) {
  for (const file of [stored, recorded]) if (isPawprintFile(file) && exists(file)) return file;
  const folders = String(env).split(path.delimiter).filter(Boolean);
  if (dir) folders.push(path.resolve(dir, '..', 'pawprint', '.venv', 'Scripts'));
  for (const folder of folders) {
    for (const name of PAW_EXE) {
      const file = path.join(folder, name);
      if (exists(file)) return file;
    }
  }
  return null;
}

// A chosen file is only taken when it is named like Pawprint: the renderer never hands main a path to run.
export const isPawprintFile = (file) => typeof file === 'string' && PAW_EXE.includes(path.basename(file).toLowerCase());

// what the module shows for each failure; `message` is the server's own text for a Claude failure
export function pawError(code, message = '') {
  const texts = {
    noexe: 'Pawprint wurde nicht gefunden.',
    start: 'Pawprint ließ sich nicht starten.',
    timeout: 'Pawprint hat zu lange gebraucht.',
    claude: 'Claude hat nicht geantwortet.',
    auth: 'Pawprint hat Nikki nicht angenommen. Versuch es noch einmal.',
    busy: 'Es läuft schon eine Frage.',
    invalid: 'Die Frage ist leer oder zu lang (höchstens 500 Zeichen).',
  };
  return [texts[code] ?? 'Pawprint hat nicht geantwortet.', message].filter(Boolean).join(' ');
}
// a failed answer: the code for what the page does about it, and the text for what it says
const fail = (error, message = '') => ({ ok: false, error, ...(message && { message }), text: pawError(error, message) });

// exe() -> path | null · freePort() -> Promise<number> · spawn(file, args, { env }) -> child with pid, stdout, stderr, on(), · kill(child)
// fetch(url, { headers, signal }) like the global one · onPhase('starting' | 'asking' | 'idle') tells the page what is going on
export function createPaw({ exe, freePort, spawn, kill, fetch = globalThis.fetch, token, pid = process.pid, onPhase = () => {},
  readyMs = 180000, askMs = 180000, idleMs = 10 * 60 * 1000, pollMs = 400, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) }) {
  let child = null;
  let base = null; // http://127.0.0.1:port once the server answers
  let starting = null;
  let busy = false;
  let idle = null;
  let tail = ''; // the last words the server printed, shown when it does not start

  function reset() {
    clearTimeout(idle);
    child = base = starting = null;
  }

  function stop() {
    const c = child;
    reset();
    if (c) kill(c);
    onPhase('idle');
  }

  async function start(file) {
    onPhase('starting');
    const port = await freePort();
    tail = '';
    const c = (child = spawn(file, ['serve', '--port', String(port), '--parent-pid', String(pid)], { env: { ...process.env, PAWPRINT_TOKEN: token, PYTHONIOENCODING: 'utf-8' } }));
    let exited = false;
    const keep = (d) => (tail = (tail + String(d)).slice(-400));
    c.stdout?.on('data', keep);
    c.stderr?.on('data', keep);
    c.on('exit', () => {
      exited = true;
      if (child === c) reset();
    });
    c.on('error', (e) => {
      exited = true;
      tail = `${e.code ?? e.message}`;
      if (child === c) reset();
    });
    const url = `http://127.0.0.1:${port}`;
    const until = Date.now() + readyMs;
    while (Date.now() < until) {
      if (exited) throw Object.assign(new Error(tail.trim().split('\n').pop() ?? ''), { code: 'start' });
      try {
        if ((await fetch(`${url}/`, { signal: AbortSignal.timeout(1500) })).ok) return (base = url);
      } catch {} // not listening yet
      await sleep(pollMs);
    }
    stop();
    throw Object.assign(new Error(''), { code: 'timeout' });
  }

  async function ask(question) {
    const q = typeof question === 'string' ? question.trim() : '';
    if (!q || q.length > MAX_QUESTION) return fail('invalid');
    if (busy) return fail('busy');
    const file = exe();
    if (!file) return fail('noexe');
    busy = true;
    clearTimeout(idle);
    try {
      if (!base) base = await (starting ??= start(file)).finally(() => (starting = null));
      onPhase('asking');
      const r = await fetch(`${base}/api/ask?q=${encodeURIComponent(q)}`, { headers: { 'X-Pawprint-Token': token }, signal: AbortSignal.timeout(askMs) });
      if (r.status === 401) return fail('auth');
      const body = await r.json().catch(() => ({}));
      if (!r.ok) return fail(r.status === 502 ? 'claude' : 'http', typeof body.detail === 'string' ? body.detail : '');
      return { ok: true, answer: String(body.answer ?? ''), sources: Array.isArray(body.sources) ? body.sources : [] };
    } catch (e) {
      if (e?.name === 'TimeoutError' || e?.name === 'AbortError') {
        stop(); // a hung server must not stay
        return fail('timeout');
      }
      return fail(e?.code === 'start' || e?.code === 'timeout' ? e.code : 'http', e?.code === 'start' ? e.message : '');
    } finally {
      busy = false;
      onPhase('idle');
      if (child) {
        idle = setTimeout(stop, idleMs);
        idle.unref?.();
      }
    }
  }

  return { ask, stop, running: () => !!child };
}
