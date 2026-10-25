import { app, BrowserWindow, clipboard, dialog, globalShortcut, ipcMain, Menu, nativeImage, net, Notification, protocol, screen, shell, Tray } from 'electron';
import { execFile, execFileSync, spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createBackend } from './lib/agent.js';
import { findCursorAgent } from './lib/cursor-path.js';
import { listCursorModels, peekCursorModels } from './lib/cursor-models.js';
import { findGemini } from './lib/gemini-path.js';
import { withHooks, withoutHooks } from './lib/hooks.js';
import { withCursorHooks, withoutCursorHooks } from './lib/hooks-cursor.js';
import { hookToStatus } from './lib/status.js';

const dir = path.dirname(fileURLToPath(import.meta.url));

// Serve the app from app://bundle/ so fetch() works for the Rive file and wasm (Chromium blocks fetch on file://).
protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
function serveApp(req) {
  const file = path.normalize(path.join(dir, decodeURIComponent(new URL(req.url).pathname)));
  if (!file.startsWith(dir + path.sep) || !fs.existsSync(file)) return new Response('not found', { status: 404 });
  return net.fetch(pathToFileURL(file).toString());
}
const claudePath = path.join(os.homedir(), '.local', 'bin', 'claude.exe');
const WIDTH = 760; // expanded island width; height stays compact
const HEIGHT = 320; // fixed open island (panel 228px + bar + shadow)

// Usage must run on the user's own subscription, never on an API key that happens to be set.
delete process.env.ANTHROPIC_API_KEY;
delete process.env.CURSOR_API_KEY;

// --- tiny JSON store: recent projects + last session per project/backend
const storeFile = path.join(app.getPath('userData'), 'state.json');
let store = {
  projects: [],
  sessions: {},
  models: {},
  backends: {},
  favorites: { claude: [], cursor: [], gemini: [] },
  chats: [],
  lastChatId: null,
  muted: false,
  hooks: false,
  cursorHooks: false,
};
try {
  store = { ...store, ...JSON.parse(fs.readFileSync(storeFile, 'utf8')) };
  store.favorites = {
    claude: store.favorites?.claude ?? [],
    cursor: store.favorites?.cursor ?? [],
    gemini: store.favorites?.gemini ?? [],
  };
  store.chats = Array.isArray(store.chats) ? store.chats : [];
  store.lastChatId = store.lastChatId ?? null;
} catch {}
const save = () => fs.writeFileSync(storeFile, JSON.stringify(store, null, 2));
const MAX_CHATS = 40;
const favBackend = (id) => (id === 'cursor' ? 'cursor' : id === 'gemini' || id === 'aistudio' ? 'gemini' : 'claude');
const addProject = (p) => {
  store.projects = [p, ...store.projects.filter((x) => x !== p)].slice(0, 8);
  save();
};

function getSession(cwd, backend) {
  const v = store.sessions[cwd];
  if (!v) return undefined;
  if (typeof v === 'string') return backend === 'claude' ? v : undefined;
  return v[backend];
}
function setSession(cwd, backend, id) {
  const cur = store.sessions[cwd];
  const obj = typeof cur === 'string' ? { claude: cur } : { ...(cur || {}) };
  obj[backend] = id;
  store.sessions[cwd] = obj;
  save();
}

let win;
let quitting = false;
const alive = () => !!win && !win.isDestroyed() && !quitting;
const send = (channel, data) => {
  try {
    if (!alive() || win.webContents.isDestroyed()) return;
    win.webContents.send(channel, data);
  } catch {
    // window/webContents torn down mid-send (quit race)
  }
};

// --- toast while the island can't be seen (hidden via tray or behind a fullscreen app); the renderer plays the sound
function notify(body) {
  if (!alive() || win.isVisible() || !Notification.isSupported()) return;
  const n = new Notification({ title: 'Nikki', body, silent: true });
  n.on('click', showNow);
  n.show();
}

// --- permission requests (also questions and plans) wait for the renderer's answer: { answer, picks?, message? }
const pending = new Map();
let nextId = 1;
function askPermission(req, signal) {
  return new Promise((resolve) => {
    const id = nextId++;
    const finish = (answer) => {
      if (!pending.has(id)) return;
      pending.delete(id);
      resolve(answer);
    };
    pending.set(id, finish);
    if (signal?.aborted) {
      send('permission-cancel', id);
      finish({ answer: 'deny' });
      return;
    }
    signal?.addEventListener?.(
      'abort',
      () => {
        send('permission-cancel', id);
        finish({ answer: 'deny' });
      },
      { once: true },
    );
    send('permission-request', { id, ...req });
    userHidden = false;
    applyVisibility();
    notify(
      req.toolName === 'AskUserQuestion'
        ? 'Der Agent hat eine Frage an dich.'
        : req.toolName === 'ExitPlanMode'
          ? 'Der Plan wartet auf dich.'
          : 'Der Agent braucht eine Erlaubnis.',
    );
  });
}

let activeCwd = null;
let activeBackend = 'claude';

function makeAgent(id) {
  return createBackend(id, {
    claudePath,
    askPermission,
    onStatus: (s) => {
      send('status', s);
      const where = activeCwd ? path.basename(activeCwd) : 'Projekt';
      if (s.state === 'done') notify(`Fertig in ${where}.`);
      if (s.state === 'error') notify(`Fehler in ${where}.`);
    },
    onSession: (sid) => {
      setSession(activeCwd, id, sid);
      send('session', { id: sid, cwd: activeCwd, backend: id });
    },
  });
}

const agents = {
  claude: makeAgent('claude'),
  cursor: makeAgent('cursor'),
  gemini: makeAgent('gemini'),
};
const anyBusy = () => agents.claude.busy() || agents.cursor.busy() || agents.gemini.busy();

// --- the island sits at the top-center of one display: the primary one at start, the cursor's one when opened
function place(display) {
  if (!alive()) return;
  const { bounds } = display;
  try {
    win.setBounds({ x: bounds.x + Math.round((bounds.width - WIDTH) / 2), y: bounds.y, width: WIDTH, height: HEIGHT });
  } catch {}
}

function createWindow() {
  win = new BrowserWindow({
    width: WIDTH,
    height: HEIGHT,
    transparent: true,
    backgroundColor: '#00000000',
    frame: false,
    resizable: false,
    movable: false,
    hasShadow: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    // sounds must play without a click: the chime is the point when the island is hidden
    webPreferences: { preload: path.join(dir, 'preload.cjs'), autoplayPolicy: 'no-user-gesture-required' },
  });
  // clear timers before will-quit — destroy races the 50ms cursor tick otherwise
  win.on('closed', () => {
    clearInterval(cursorTimer);
    cursorTimer = null;
    win = null;
  });
  place(screen.getPrimaryDisplay());
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setIgnoreMouseEvents(true, { forward: true });
  // links in answers open in the browser; the island itself never navigates (e.g. on a stray file drop)
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  win.loadURL('app://bundle/renderer/index.html');
}

// --- visibility: hidden by the user (tray) or while a fullscreen app (game, video) is in front
let userHidden = false;
let fullscreen = false;
// first launch: stay visible through the intro even over a fullscreen game (otherwise GSAP freezes + menu appears late)
let bootHold = true;
function applyVisibility() {
  if (!alive()) return;
  try {
    const show = !userHidden && (bootHold || !fullscreen);
    if (show && !win.isVisible()) win.showInactive();
    if (!show && win.isVisible()) win.hide();
  } catch {}
}
function endBootHold() {
  if (!bootHold) return;
  bootHold = false;
  applyVisibility();
}
function showNow() {
  if (!alive()) return;
  try {
    userHidden = false;
    const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
    if (display.id !== screen.getDisplayMatching(win.getBounds()).id) place(display);
    win.show();
    win.focus();
  } catch {
    return;
  }
  // Always expand — toggle would collapse an already-open island (tray / hotkey / toast)
  send('show');
}

// Asks Windows itself whether a fullscreen app runs (SHQueryUserNotificationState), once a second.
// 2 = busy/fullscreen, 3 = D3D fullscreen, 4 = presentation mode. Exits on its own once the app is gone.
const FULLSCREEN_PS = `Add-Type -Namespace W -Name N -MemberDefinition '[DllImport("shell32.dll")] public static extern int SHQueryUserNotificationState(out int s);'
while (Get-Process -Id ${process.pid} -ErrorAction SilentlyContinue) { $s = 0; [void][W.N]::SHQueryUserNotificationState([ref]$s); [Console]::WriteLine($s); Start-Sleep -Milliseconds 1000 }`;
let fullscreenWatcher;
function watchFullscreen() {
  fullscreenWatcher = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', FULLSCREEN_PS], { windowsHide: true });
  fullscreenWatcher.stdout.on('data', (d) => {
    if (quitting) return;
    const busy = ['2', '3', '4'].includes(d.toString().trim().split(/\s+/).pop());
    if (busy === fullscreen) return;
    fullscreen = busy;
    applyVisibility();
  });
}

// --- cursor position (window-relative) for the companion's eyes; only while visible and only on change
let lastCursor = '';
let cursorTimer;
function feedCursor() {
  // 50ms was chatty for eye-tracking + click-through hit tests; 100ms is plenty
  cursorTimer = setInterval(() => {
    try {
      if (!alive() || !win.isVisible()) return;
      const p = screen.getCursorScreenPoint();
      const b = win.getBounds();
      const key = `${p.x - b.x},${p.y - b.y}`;
      if (key === lastCursor) return;
      lastCursor = key;
      send('cursor', { x: p.x - b.x, y: p.y - b.y });
    } catch {
      // destroyed between alive() and getBounds()
    }
  }, 100);
}

// --- local git glance (no GitHub OAuth): branch, dirty count, ahead/behind, browsable remote URL
const git = (cwd, args) =>
  new Promise((resolve) =>
    execFile('git', ['-C', cwd, ...args], { windowsHide: true, timeout: 4000 }, (err, out) => resolve(err ? null : String(out).trim())),
  );

function remoteToHttps(url) {
  if (!url) return null;
  let u = url.replace(/\.git$/i, '');
  const ssh = u.match(/^git@([^:]+):(.+)$/);
  if (ssh) return `https://${ssh[1]}/${ssh[2]}`;
  const sshProto = u.match(/^ssh:\/\/git@([^/]+)\/(.+)$/);
  if (sshProto) return `https://${sshProto[1]}/${sshProto[2]}`;
  if (/^https?:\/\//i.test(u)) return u;
  return null;
}

async function gitGlance(cwd) {
  if (!cwd || !fs.existsSync(cwd)) return null;
  const inside = await git(cwd, ['rev-parse', '--is-inside-work-tree']);
  if (inside !== 'true') return null;
  let branch = await git(cwd, ['branch', '--show-current']);
  if (!branch) {
    const sha = await git(cwd, ['rev-parse', '--short', 'HEAD']);
    branch = sha ? `(${sha})` : 'detached';
  }
  const porcelain = await git(cwd, ['status', '--porcelain']);
  const dirty = porcelain ? porcelain.split(/\r?\n/).filter(Boolean).length : 0;
  let ahead = 0;
  let behind = 0;
  const ab = await git(cwd, ['rev-list', '--left-right', '--count', '@{upstream}...HEAD']);
  if (ab) {
    const [left, right] = ab.split(/\s+/).map((n) => parseInt(n, 10) || 0);
    behind = left;
    ahead = right;
  }
  const remoteRaw = await git(cwd, ['config', '--get', 'remote.origin.url']);
  const remoteUrl = remoteToHttps(remoteRaw);
  let prs = null;
  if (remoteUrl?.includes('github.com')) {
    const prOut = await new Promise((resolve) =>
      execFile('gh', ['pr', 'list', '--state', 'open', '--limit', '20', '--json', 'number'], { windowsHide: true, timeout: 5000, cwd }, (err, out) =>
        resolve(err ? null : String(out).trim()),
      ),
    );
    if (prOut) {
      try {
        prs = JSON.parse(prOut).length;
      } catch {
        prs = null;
      }
    }
  }
  return { branch, dirty, ahead, behind, remoteUrl, remoteRaw: remoteRaw || null, prs };
}

ipcMain.handle('branch', async (_e, cwd) => {
  const g = await gitGlance(cwd);
  return g?.branch ?? null;
});
ipcMain.handle('git-status', async (_e, cwd) => gitGlance(cwd));
ipcMain.handle('git-open-remote', async (_e, cwd) => {
  const g = await gitGlance(cwd);
  if (!g?.remoteUrl) return { ok: false, reason: 'no-remote' };
  await shell.openExternal(g.remoteUrl);
  return { ok: true, url: g.remoteUrl };
});
ipcMain.handle('open-aistudio', async (_e, { text } = {}) => {
  const copied = !!(text && String(text).trim());
  if (copied) clipboard.writeText(String(text).trim());
  await shell.openExternal('https://aistudio.google.com/prompts/new_chat');
  return { ok: true, copied };
});

ipcMain.on('click-through', (_e, on) => alive() && win.setIgnoreMouseEvents(on, { forward: true }));
ipcMain.on('focus', () => alive() && win.focus());
ipcMain.on('boot-done', () => endBootHold());
ipcMain.on('set-muted', (_e, muted) => {
  store.muted = !!muted;
  save();
  send('muted', store.muted);
  createTray();
});
ipcMain.handle('get-state', () => ({
  ...store,
  claudeFound: fs.existsSync(claudePath),
  cursorFound: !!findCursorAgent(),
  cursorModels: peekCursorModels(),
  geminiFound: !!findGemini(),
  terminal: [...terminal.values()],
}));
ipcMain.handle('cursor-models', () => listCursorModels({ force: true }));
ipcMain.handle('toggle-favorite', (_e, { backend, modelId }) => {
  const key = favBackend(backend);
  const id = modelId == null || modelId === '' ? '__auto__' : String(modelId);
  const list = [...(store.favorites[key] || [])];
  const i = list.indexOf(id);
  if (i >= 0) list.splice(i, 1);
  else list.push(id);
  store.favorites[key] = list;
  save();
  return store.favorites;
});
ipcMain.handle('set-model', (_e, { cwd, backend, model }) => {
  if (!cwd) return store.models;
  const key = favBackend(backend);
  const prev = store.models[cwd];
  const obj =
    prev && typeof prev === 'object' && !Array.isArray(prev)
      ? { ...prev }
      : { claude: typeof prev === 'string' || prev === null || prev === undefined ? prev ?? null : null };
  obj[key] = model ?? null;
  store.models[cwd] = obj;
  store.backends[cwd] = store.backends[cwd] ?? key;
  save();
  return store.models;
});
ipcMain.handle('chats-list', () =>
  [...(store.chats || [])].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)),
);
ipcMain.handle('chats-save', (_e, chat) => {
  if (!chat?.id) return store.chats;
  const next = {
    id: String(chat.id),
    cwd: chat.cwd || '',
    backend: favBackend(chat.backend),
    title: String(chat.title || 'Chat').slice(0, 80),
    sessionId: chat.sessionId ? String(chat.sessionId) : null,
    messages: Array.isArray(chat.messages)
      ? chat.messages
          .slice(-80)
          .map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', text: String(m.text || '').slice(0, 20000), at: m.at || Date.now() }))
      : [],
    updatedAt: Date.now(),
  };
  store.chats = [next, ...(store.chats || []).filter((c) => c.id !== next.id)].slice(0, MAX_CHATS);
  store.lastChatId = next.id;
  save();
  return store.chats;
});
ipcMain.handle('chats-delete', (_e, id) => {
  store.chats = (store.chats || []).filter((c) => c.id !== id);
  if (store.lastChatId === id) store.lastChatId = store.chats[0]?.id ?? null;
  save();
  return store.chats;
});
ipcMain.handle('set-last-chat', (_e, id) => {
  store.lastChatId = id || null;
  save();
  return store.lastChatId;
});
ipcMain.handle('pick-folder', async () => {
  const r = await dialog.showOpenDialog(win, { properties: ['openDirectory'] });
  if (r.canceled) return null;
  addProject(r.filePaths[0]);
  return r.filePaths[0];
});
ipcMain.handle('start', (_e, { prompt, cwd, newSession, plan, model, backend, sessionId }) => {
  const id = backend === 'cursor' ? 'cursor' : backend === 'gemini' || backend === 'aistudio' ? 'gemini' : 'claude';
  if (anyBusy() || !prompt.trim() || !cwd || !fs.existsSync(cwd)) return false;
  if (id === 'claude' && !fs.existsSync(claudePath)) return false;
  if (id === 'cursor' && !findCursorAgent()) return false;
  if (id === 'gemini' && !findGemini()) return false;
  activeCwd = cwd;
  activeBackend = id;
  addProject(cwd);
  {
    const prev = store.models[cwd];
    const obj =
      prev && typeof prev === 'object' && !Array.isArray(prev)
        ? { ...prev }
        : { claude: typeof prev === 'string' || prev === null || prev === undefined ? prev ?? null : null };
    obj[id] = model ?? null;
    store.models[cwd] = obj;
  }
  store.backends[cwd] = id;
  save();
  const resume = newSession ? undefined : sessionId || getSession(cwd, id);
  agents[id].start(prompt, cwd, resume, { plan, model: model ?? undefined });
  return true;
});
ipcMain.on('open-external', (_e, url) => /^https?:\/\//i.test(url) && shell.openExternal(url));
ipcMain.on('stop', () => agents[activeBackend]?.stop());
ipcMain.on('permission-answer', (_e, { id, ...answer }) => {
  pending.get(id)?.(answer);
});

// --- terminal / IDE sessions: Claude + Cursor hooks POST their events to this local server
const terminal = new Map(); // session_id -> { id, cwd, state, text, at, source? }
const STALE_MS = 30 * 60 * 1000; // no event for 30 min: the terminal was probably closed without SessionEnd
const hookCfgFile = path.join(app.getPath('userData'), 'hook.json');
const hookToken = crypto.randomBytes(16).toString('hex');
function onHook(e) {
  // Cursor always sends conversation_id; Claude sends session_id — accept either (as string).
  const sid = e?.session_id != null ? String(e.session_id) : e?.conversation_id != null ? String(e.conversation_id) : '';
  if (!sid) return;
  e.session_id = sid;
  const prev = terminal.get(e.session_id);
  let s = null;
  if (e.hook_event_name === 'SessionEnd') terminal.delete(e.session_id);
  else {
    s = hookToStatus(e, prev);
    if (!s) return;
    terminal.set(e.session_id, { id: e.session_id, cwd: String(e.cwd ?? ''), source: e.source, ...s, at: Date.now() });
  }
  for (const [id, t] of terminal) if (Date.now() - t.at > STALE_MS) terminal.delete(id);
  const changed = s && s.state !== prev?.state ? s.state : undefined; // one chime/toast per prompt, not per event
  send('terminal', { sessions: [...terminal.values()], changed });
  if (changed === 'needsYou') notify(`${path.basename(e.cwd)}: ${s.text}`);
  if (changed === 'done') notify(`Session in ${path.basename(e.cwd)} ist fertig.`);
}
let hookServer;
function startHookServer() {
  hookServer = http.createServer((req, res) => {
    if (quitting) return res.writeHead(503).end();
    if (req.method !== 'POST' || req.headers['x-token'] !== hookToken) return res.writeHead(403).end();
    let body = '';
    req.on('data', (d) => {
      body += d;
      if (body.length > 1e6) req.destroy(); // hook input is small; never buffer without limit
    });
    req.on('end', () => {
      res.end();
      if (quitting) return;
      try {
        onHook(JSON.parse(body));
      } catch {}
    });
  });
  hookServer.listen(0, '127.0.0.1', () => fs.writeFileSync(hookCfgFile, JSON.stringify({ port: hookServer.address().port, token: hookToken })));
}

// --- hooks in the user's global Claude Code / Cursor settings: only on request, with a backup, removed cleanly when switched off
const settingsFile = path.join(os.homedir(), '.claude', 'settings.json');
const cursorHooksFile = path.join(os.homedir(), '.cursor', 'hooks.json');
const slash = (p) => p.replaceAll('\\', '/'); // the same command works in Git Bash and PowerShell
function findNodeBin() {
  const candidates = [];
  try {
    const out = execFileSync(process.platform === 'win32' ? 'where.exe' : 'which', ['node'], {
      windowsHide: true,
      encoding: 'utf8',
      timeout: 3000,
    });
    candidates.push(...out.split(/\r?\n/).map((s) => s.trim()).filter(Boolean));
  } catch {}
  // Prefer system Node over cursor-agent's bundled node (path breaks on CLI updates).
  const preferred =
    candidates.find((p) => /nodejs|program files/i.test(p)) ||
    candidates.find((p) => !/cursor-agent/i.test(p)) ||
    candidates[0];
  return preferred || 'node';
}
// Absolute node path: Cursor's hook PATH often lacks `node`, so bare `node` silently never runs.
const hookCommand = () => `"${slash(findNodeBin())}" "${slash(path.join(dir, 'hook.cjs'))}" "${slash(hookCfgFile)}"`;

function writeJsonSettings(file, mutate) {
  let settings = {};
  try {
    if (fs.existsSync(file)) settings = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    dialog.showErrorBox('Nikki', `${file} ist kein gültiges JSON. Ich ändere daran nichts.`);
    return false;
  }
  if (fs.existsSync(file)) fs.copyFileSync(file, `${file}.desktopcompanion-backup`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(mutate(settings), null, 2));
  return true;
}
function writeHooks(on) {
  return writeJsonSettings(settingsFile, (s) => (on ? withHooks(s, hookCommand()) : withoutHooks(s)));
}
function writeCursorHooks(on) {
  return writeJsonSettings(cursorHooksFile, (s) => (on ? withCursorHooks(s, hookCommand()) : withoutCursorHooks(s)));
}

const hasNode = () => new Promise((resolve) => execFile('node', ['-v'], { windowsHide: true, timeout: 5000 }, (err) => resolve(!err)));
async function setHooks(on) {
  if (on && !(await hasNode())) {
    dialog.showErrorBox('Nikki', 'Für Terminal-Sessions braucht es Node.js (der Befehl „node“ wurde nicht gefunden).');
    on = false;
  } else if (!writeHooks(on)) on = store.hooks;
  store.hooks = on;
  save();
  if (!on && !store.cursorHooks) {
    terminal.clear();
    send('terminal', { sessions: [] });
  }
  createTray();
}
async function setCursorHooks(on) {
  if (on && !(await hasNode())) {
    dialog.showErrorBox('Nikki', 'Für Cursor-Sessions braucht es Node.js (der Befehl „node“ wurde nicht gefunden).');
    on = false;
  } else if (!writeCursorHooks(on)) on = store.cursorHooks;
  store.cursorHooks = on;
  save();
  if (!on && !store.hooks) {
    terminal.clear();
    send('terminal', { sessions: [] });
  }
  createTray();
}

// A second launch (e.g. double-clicking the .exe again) just opens the island of the running one.
// `Nikki.exe --quit` (used by Updater.exe) closes the running one cleanly instead.
const quitRequest = process.argv.includes('--quit');
const firstInstance = app.requestSingleInstanceLock();
if (!firstInstance || quitRequest) app.quit();
app.on('second-instance', (_e, argv) => (argv.includes('--quit') ? app.quit() : alive() && showNow()));

let tray; // module-level so it isn't garbage-collected
let hotkey;
function createTray() {
  if (!tray) {
    tray = new Tray(nativeImage.createFromPath(path.join(dir, 'assets', 'icon.png')).resize({ width: 16, height: 16 }));
    tray.on('click', showNow);
  }
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: 'Ein-/Ausblenden',
        click: () => {
          if (!alive()) return;
          userHidden = win.isVisible();
          applyVisibility();
        },
      },
      { type: 'separator' },
      {
        label: 'Töne',
        type: 'checkbox',
        checked: !store.muted,
        click: (item) => {
          store.muted = !item.checked;
          save();
          send('muted', store.muted);
        },
      },
      {
        label: 'Mit Windows starten',
        type: 'checkbox',
        enabled: app.isPackaged, // in dev this would register electron.exe
        checked: app.getLoginItemSettings().openAtLogin,
        click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked }),
      },
      { label: 'Claude Terminal-Sessions', type: 'checkbox', checked: store.hooks, click: (item) => setHooks(item.checked) },
      {
        label: 'Cursor-Sessions beobachten',
        type: 'checkbox',
        checked: store.cursorHooks,
        click: (item) => setCursorHooks(item.checked),
      },
      { type: 'separator' },
      { label: 'Beenden', click: () => app.quit() },
    ]),
  );
}

app.whenReady().then(() => {
  if (!firstInstance || quitRequest) return;
  protocol.handle('app', serveApp);
  app.setAppUserModelId('local.nikki'); // Windows shows toasts only for an app with an id
  createWindow();
  createTray();
  watchFullscreen();
  feedCursor();
  startHookServer();
  // safety: if the renderer never signals, still allow fullscreen-hide after the intro window
  setTimeout(endBootHold, 5000);
  if (store.hooks) writeHooks(true); // refresh the hook path, e.g. after an update moved the app
  if (store.cursorHooks) writeCursorHooks(true);
  // a display that went away or changed: put the island back on the display it overlaps most (or the nearest)
  const replace = () => alive() && place(screen.getDisplayMatching(win.getBounds()));
  screen.on('display-removed', replace);
  screen.on('display-metrics-changed', replace);
  // explicit user action: shows the island even over a fullscreen app
  // Ctrl+Alt+Space is often taken (e.g. by Claude Desktop): fall back to Ctrl+Alt+K.
  hotkey = ['Control+Alt+Space', 'Control+Alt+K'].find((k) => globalShortcut.register(k, showNow)) ?? null;
  tray.setToolTip(hotkey ? `Nikki (${hotkey.replace('Control', 'Strg').replace('Space', 'Leertaste')})` : 'Nikki');
});
app.on('before-quit', () => {
  quitting = true;
  clearInterval(cursorTimer);
  cursorTimer = null;
});
app.on('will-quit', () => {
  quitting = true;
  clearInterval(cursorTimer);
  cursorTimer = null;
  agents.claude.stop();
  agents.cursor.stop();
  agents.cursor.dispose?.();
  agents.gemini.stop();
  try {
    fullscreenWatcher?.stdout?.removeAllListeners('data');
    fullscreenWatcher?.kill();
  } catch {}
  try {
    hookServer?.close();
  } catch {}
  globalShortcut.unregisterAll();
});
// last resort: swallow the known destroy race on exit (dialog would outlive the app)
process.on('uncaughtException', (err) => {
  if (quitting && /has been destroyed/i.test(String(err?.message ?? err))) return;
  console.error(err);
});
