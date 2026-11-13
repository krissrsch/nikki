import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import path from 'node:path';
import { createPaw, findPawprint, isPawprintFile, pawEnv, pawError } from './paw.js';

const tick = () => new Promise((r) => setImmediate(r));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

test('Pawprint finden: gewählter Pfad vor dem von Pawprint hinterlegten vor PATH vor Entwicklungsordner; nur Dateien, die es gibt', () => {
  const chosen = 'C:\\Tools\\pawprint.exe';
  const left = 'C:\\Programmieren\\Tools\\pawprint\\.venv\\Scripts\\pawprint.exe'; // what Pawprint wrote into ~/.pawprint/pawprint-path.txt
  const any = (f) => true;
  assert.equal(findPawprint({ stored: chosen, recorded: left, exists: any }), chosen);
  assert.equal(findPawprint({ stored: '', recorded: left, env: 'C:\\py\\Scripts', exists: any }), left);
  assert.equal(findPawprint({ stored: '', recorded: 'C:\\evil\\calc.exe', exists: (f) => f === 'C:\\evil\\calc.exe' }), null, 'only a file named pawprint.exe is taken');
  const onPath = path.join('C:\\py\\Scripts', 'pawprint.exe');
  const dev = path.join(path.resolve('C:\\proj\\nikki', '..', 'pawprint', '.venv', 'Scripts'), 'pawprint.exe');
  const env = ['C:\\bin', 'C:\\py\\Scripts'].join(path.delimiter);
  const has = (...files) => (f) => files.includes(f);
  assert.equal(findPawprint({ stored: chosen, env, dir: 'C:\\proj\\nikki', exists: has(chosen, onPath, dev) }), chosen);
  assert.equal(findPawprint({ stored: 'C:\\gone.exe', env, dir: 'C:\\proj\\nikki', exists: has(onPath, dev) }), onPath);
  assert.equal(findPawprint({ stored: '', env, dir: 'C:\\proj\\nikki', exists: has(dev) }), dev);
  assert.equal(findPawprint({ stored: '', env, dir: 'C:\\proj\\nikki', exists: has() }), null);
  assert.equal(findPawprint({ env: undefined, exists: has() }), null);
});

test('nur Dateien, die wie Pawprint heißen, dürfen als Programm gewählt werden', () => {
  assert.equal(isPawprintFile('C:\\x\\pawprint.exe'), true);
  assert.equal(isPawprintFile('C:\\x\\PAWPRINT.EXE'), true);
  for (const bad of ['C:\\x\\powershell.exe', 'C:\\x\\pawprint.exe.txt', 'C:\\x\\pawprint.cmd', '', null, 42]) assert.equal(isPawprintFile(bad), false, String(bad));
});

test('Fehlertexte: bekannt, unbekannt, mit Meldung des Servers', () => {
  assert.match(pawError('noexe'), /nicht gefunden/);
  assert.equal(pawError('claude', 'Bist du eingeloggt?'), 'Claude hat nicht geantwortet. Bist du eingeloggt?');
  assert.equal(pawError('wasauchimmer'), 'Pawprint hat nicht geantwortet.');
});

// a fake pawprint: a child that "listens" after `readyAfter` polls, and a fetch that plays the server
function rig(opts = {}) {
  const spawned = [];
  const killed = [];
  const calls = [];
  const phases = [];
  let polls = 0;
  let answer = opts.answer ?? { status: 200, body: { answer: 'Ja [Quelle 1]', sources: [{ project: 'demo', date: '2026-10-01', title: 't', text: 'x' }] } };
  const spawn = (file, args, o) => {
    const c = Object.assign(new EventEmitter(), { pid: 100 + spawned.length, stdout: new EventEmitter(), stderr: new EventEmitter() });
    spawned.push({ file, args, env: o.env, child: c });
    if (opts.die) setImmediate(() => (c.stderr.emit('data', 'Traceback\nModuleNotFoundError: fastapi'), c.emit('exit', 1)));
    return c;
  };
  const fetch = async (url, o = {}) => {
    calls.push({ url, headers: o.headers });
    if (url.endsWith('/')) return { ok: ++polls > (opts.readyAfter ?? 1) && !opts.never };
    // like the real fetch: a hanging answer ends with the signal's reason when the time is up
    if (opts.hold) await Promise.race([opts.hold, new Promise((_, no) => o.signal?.addEventListener('abort', () => no(o.signal.reason)))]);
    return { ok: answer.status === 200, status: answer.status, json: async () => answer.body };
  };
  const paw = createPaw({
    exe: () => (opts.noexe ? null : 'C:\\p\\pawprint.exe'),
    freePort: async () => 4711,
    spawn,
    kill: (c) => killed.push(c.pid),
    fetch,
    token: 'geheim',
    pid: 42,
    onPhase: (p) => phases.push(p),
    readyMs: opts.readyMs ?? 2000,
    idleMs: opts.idleMs ?? 60000,
    pollMs: 1,
    sleep: () => tick(),
    ...opts.extra,
  });
  return { paw, spawned, killed, calls, phases, setAnswer: (a) => (answer = a) };
}

test('Pawprint bekommt nur die nötige Umgebung: keine fremden Schlüssel, keine Variablen einer Claude-Sitzung', () => {
  const env = pawEnv({ Path: 'C:\\bin', SystemRoot: 'C:\\Windows', USERPROFILE: 'C:\\Users\\a', PAWPRINT_THREADS: '8',
    ANTHROPIC_BASE_URL: 'x', GITHUB_TOKEN: 'ghp_x', AWS_SECRET_ACCESS_KEY: 'y', NO_COLOR: '1', CLAUDECODE: '1',
    CLAUDE_CODE_ENTRYPOINT: 'cli', PAWPRINT_TOKEN: 'alt' }, 'neu');
  assert.deepEqual(env, { Path: 'C:\\bin', SystemRoot: 'C:\\Windows', USERPROFILE: 'C:\\Users\\a', PAWPRINT_THREADS: '8',
    ANTHROPIC_BASE_URL: 'x', PAWPRINT_TOKEN: 'neu', PYTHONIOENCODING: 'utf-8' });
});

test('erste Frage startet Pawprint mit Token in der Umgebung, nicht in den Argumenten, und bekommt die Antwort', async () => {
  const r = rig();
  const out = await r.paw.ask('  Wie war das mit Kanto?  ');
  assert.deepEqual(out, { ok: true, answer: 'Ja [Quelle 1]', sources: [{ project: 'demo', date: '2026-10-01', title: 't', text: 'x' }] });
  assert.equal(r.spawned.length, 1);
  assert.deepEqual(r.spawned[0].args, ['serve', '--port', '4711', '--parent-pid', '42']);
  assert.equal(r.spawned[0].env.PAWPRINT_TOKEN, 'geheim');
  assert.ok(!r.spawned[0].args.join(' ').includes('geheim'));
  const askCall = r.calls.find((c) => c.url.includes('/api/ask'));
  assert.equal(askCall.url, 'http://127.0.0.1:4711/api/ask?q=Wie%20war%20das%20mit%20Kanto%3F');
  assert.equal(askCall.headers['X-Pawprint-Token'], 'geheim');
  assert.deepEqual(r.phases, ['starting', 'asking', 'idle']);
  r.paw.stop();
});

test('zweite Frage startet nichts neu; nach dem Beenden des Servers startet die nächste Frage ihn wieder', async () => {
  const r = rig();
  await r.paw.ask('eins');
  await r.paw.ask('zwei');
  assert.equal(r.spawned.length, 1);
  r.spawned[0].child.emit('exit', 0); // killed from outside
  assert.equal(r.paw.running(), false);
  await r.paw.ask('drei');
  assert.equal(r.spawned.length, 2);
  r.paw.stop();
});

test('ungültige Fragen, fehlendes Programm und eine zweite Frage während der ersten', async () => {
  const r = rig();
  assert.equal((await r.paw.ask('')).error, 'invalid');
  assert.equal((await r.paw.ask('x'.repeat(501))).error, 'invalid');
  assert.equal((await r.paw.ask({ q: 1 })).error, 'invalid');
  assert.equal(r.spawned.length, 0);
  const none = await rig({ noexe: true }).paw.ask('hallo');
  assert.deepEqual([none.ok, none.error, none.text], [false, 'noexe', 'Pawprint wurde nicht gefunden.']);

  let release;
  const slow = rig({ hold: new Promise((res) => (release = res)) });
  const first = slow.paw.ask('langsam');
  await wait(10);
  assert.equal((await slow.paw.ask('gleichzeitig')).error, 'busy');
  release();
  assert.equal((await first).ok, true);
  slow.paw.stop();
});

test('Start scheitert: der Server beendet sich sofort, seine letzte Zeile kommt mit', async () => {
  const r = rig({ die: true });
  const out = await r.paw.ask('hallo');
  assert.equal(out.ok, false);
  assert.equal(out.error, 'start');
  assert.equal(out.message, 'ModuleNotFoundError: fastapi');
  assert.equal(out.text, 'Pawprint ließ sich nicht starten. ModuleNotFoundError: fastapi');
  assert.equal(r.paw.running(), false);
  assert.equal(r.phases.at(-1), 'idle');
});

test('Server wird nie bereit: Zeitlimit, der Prozess wird beendet', async () => {
  const r = rig({ never: true, readyMs: 30 });
  const out = await r.paw.ask('hallo');
  assert.equal(out.error, 'timeout');
  assert.deepEqual(r.killed, [100]);
  assert.equal(r.paw.running(), false);
});

test('Fehler des Servers: 502 heißt Claude, 401 Token, sonst allgemein; die Meldung des Servers bleibt erhalten', async () => {
  const r = rig({ answer: { status: 502, body: { detail: 'Bist du eingeloggt?' } } });
  const a = await r.paw.ask('a');
  assert.deepEqual([a.error, a.message, a.text], ['claude', 'Bist du eingeloggt?', 'Claude hat nicht geantwortet. Bist du eingeloggt?']);
  r.setAnswer({ status: 401, body: {} });
  assert.equal((await r.paw.ask('b')).error, 'auth');
  r.setAnswer({ status: 500, body: 'kaputt' });
  const c = await r.paw.ask('c');
  assert.deepEqual([c.error, c.message], ['http', undefined]);
  r.paw.stop();
});

test('nach einer Pause ohne Fragen beendet Nikki Pawprint; stop() beendet es sofort', async () => {
  const r = rig({ idleMs: 25 });
  await r.paw.ask('a');
  assert.equal(r.paw.running(), true);
  await wait(80);
  assert.deepEqual(r.killed, [100]);
  assert.equal(r.paw.running(), false);
  await r.paw.ask('b');
  r.paw.stop();
  assert.deepEqual(r.killed, [100, 101]);
  r.paw.stop(); // twice is fine
  assert.equal(r.killed.length, 2);
});

test('ein Zeitlimit bei der Antwort beendet den hängenden Server', async () => {
  const r = rig({ hold: new Promise(() => {}), extra: { askMs: 20 } });
  const out = await r.paw.ask('hängt');
  assert.equal(out.error, 'timeout');
  assert.deepEqual(r.killed, [100]);
});
