import { app, BrowserWindow, dialog, globalShortcut, ipcMain, Menu, nativeImage, net, Notification, protocol, screen, shell, Tray } from 'electron';
import { execFile, spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createClaudeAgent } from './backends/claude.js';
import { withoutCursorHooks } from './lib/cursor-migration.js';
import { hookCommandIn, withHooks, withoutHooks } from './lib/hooks.js';
import { editJson, readJson, writeJsonAtomic } from './lib/json-file.js';
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

// --- tiny JSON store: recent projects + last session per project/backend
const storeFile = path.join(app.getPath('userData'), 'state.json');
let store = {
  projects: [],
  sessions: {},
  models: {},
  favorites: { claude: [] },
  chats: [],
  lastChatId: null,
  muted: false,
  hooks: false,
};
let storeNotice = null; // shown once the app is ready
let storeWritable = true; // never overwrite a state.json we could not read: that is how chats got lost (H2)
try {
  const saved = readJson(storeFile, (moved) => (storeNotice = `Nikkis Daten waren beschädigt und wurden nach\n${moved}\nverschoben. Nikki startet mit leerem Stand.`));
  if (saved && typeof saved === 'object') store = { ...store, ...saved };
  store.projects = Array.isArray(store.projects) ? store.projects : [];
  store.favorites = { claude: store.favorites?.claude ?? [] };
  store.chats = Array.isArray(store.chats) ? store.chats : [];
  store.lastChatId = store.lastChatId ?? null;
} catch (e) {
  storeWritable = false;
  storeNotice = `Nikki kann ${storeFile} nicht lesen (${e.code ?? e.message}). Bis zum Neustart speichert Nikki nichts.`;
}
let saveFailed = false;
function save() {
  if (!storeWritable) return;
  try {
    writeJsonAtomic(storeFile, store);
    saveFailed = false;
  } catch (e) {
    console.error('state.json:', e);
    if (!saveFailed && app.isReady()) dialog.showMessageBox({ type: 'warning', title: 'Nikki', message: `Nikki kann nicht speichern: ${e.code ?? e.message}` }).catch(() => {});
    saveFailed = true; // one message per run of failures, not one per save
  }
}
const MAX_CHATS = 40;
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

const agent = createClaudeAgent({
  claudePath,
  askPermission,
  onStatus: (s) => {
    send('status', s);
    const where = activeCwd ? path.basename(activeCwd) : 'Projekt';
    if (s.state === 'done') notify(`Fertig in ${where}.`);
    if (s.state === 'error') notify(`Fehler in ${where}.`);
  },
  onSession: (sid) => {
    setSession(activeCwd, 'claude', sid);
    send('session', { id: sid, cwd: activeCwd });
  },
});

// --- the island sits at the top-center of one display: the primary one at start, the mouse pointer's one when opened
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
  // clear timers before will-quit — destroy races the pointer tick otherwise
  win.on('closed', () => {
    clearInterval(pointerTimer);
    pointerTimer = null;
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

// --- mouse pointer position (window-relative) for the companion's eyes; only while visible and only on change
let lastPointer = '';
let pointerTimer;
function feedPointer() {
  // 50ms was chatty for eye-tracking + click-through hit tests; 100ms is plenty
  pointerTimer = setInterval(() => {
    try {
      if (!alive() || !win.isVisible()) return;
      const p = screen.getCursorScreenPoint();
      const b = win.getBounds();
      const key = `${p.x - b.x},${p.y - b.y}`;
      if (key === lastPointer) return;
      lastPointer = key;
      send('pointer', { x: p.x - b.x, y: p.y - b.y });
    } catch {
      // destroyed between alive() and getBounds()
    }
  }, 100);
}

// --- branch label in the chat: one git call, asked for on project change and turn end (no polling)
ipcMain.handle('branch', (_e, cwd) =>
  !cwd || !fs.existsSync(cwd)
    ? null
    : new Promise((resolve) =>
        execFile('git', ['-C', cwd, 'branch', '--show-current'], { windowsHide: true, timeout: 4000 }, (err, out) =>
          resolve((!err && String(out).trim()) || null),
        ),
      ),
);

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
  terminal: [...terminal.values()],
}));
ipcMain.handle('toggle-favorite', (_e, { modelId }) => {
  const id = modelId == null || modelId === '' ? '__auto__' : String(modelId);
  const list = store.favorites.claude;
  store.favorites.claude = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
  save();
  return store.favorites;
});
// per project { claude: model }: the shape the renderer already reads
const setModel = (cwd, model) => (store.models[cwd] = { claude: model ?? null });
ipcMain.handle('set-model', (_e, { cwd, model }) => {
  if (!cwd) return store.models;
  setModel(cwd, model);
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
ipcMain.handle('start', (_e, { prompt, cwd, newSession, plan, model, sessionId }) => {
  if (agent.busy() || !prompt.trim() || !cwd || !fs.existsSync(cwd) || !fs.existsSync(claudePath)) return false;
  activeCwd = cwd;
  addProject(cwd);
  setModel(cwd, model);
  save();
  const resume = newSession ? undefined : sessionId || getSession(cwd, 'claude');
  agent.start(prompt, cwd, resume, { plan, model: model ?? undefined });
  return true;
});
ipcMain.on('open-external', (_e, url) => /^https?:\/\//i.test(url) && shell.openExternal(url));
ipcMain.on('stop', () => agent.stop());
ipcMain.on('permission-answer', (_e, { id, ...answer }) => {
  pending.get(id)?.(answer);
});

// --- terminal sessions: Claude Code hooks POST their events to this local server
const terminal = new Map(); // session_id -> { id, cwd, state, text, at }
const STALE_MS = 30 * 60 * 1000; // no event for 30 min: the terminal was probably closed without SessionEnd
const hookCfgFile = path.join(app.getPath('userData'), 'hook.json');
const hookToken = crypto.randomBytes(16).toString('hex');
function onHook(e) {
  const sid = e?.session_id != null ? String(e.session_id) : '';
  if (!sid) return;
  e.session_id = sid;
  const prev = terminal.get(e.session_id);
  let s = null;
  if (e.hook_event_name === 'SessionEnd') terminal.delete(e.session_id);
  else {
    s = hookToStatus(e, prev);
    if (!s) return;
    terminal.set(e.session_id, { id: e.session_id, cwd: String(e.cwd ?? ''), ...s, at: Date.now() });
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
  hookServer.listen(0, '127.0.0.1', () => {
    try {
      writeJsonAtomic(hookCfgFile, { port: hookServer.address().port, token: hookToken }); // hooks never read half a file
    } catch (e) {
      console.error('hook.json:', e);
    }
  });
}

// --- hooks in the user's global Claude Code settings: only on request, with a backup, removed cleanly when switched off
const settingsFile = path.join(os.homedir(), '.claude', 'settings.json');
const cursorHooksFile = path.join(os.homedir(), '.cursor', 'hooks.json'); // only for the 1.0 → 1.1 migration
const slash = (p) => p.replaceAll('\\', '/'); // the same command works in Git Bash and PowerShell
// Path of the system Node (null without one), looked up without blocking the main thread.
const findNode = () =>
  new Promise((resolve) =>
    execFile('where.exe', ['node'], { windowsHide: true, timeout: 3000 }, (err, out) => {
      const found = err ? [] : String(out).split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
      // Prefer system Node over a node bundled with some CLI (that path breaks on CLI updates).
      resolve(found.find((p) => /nodejs|program files/i.test(p)) || found[0] || null);
    }),
  );
// Absolute node path: a hook's PATH may lack `node`, and then a bare `node` silently never runs.
const hookCommand = (node) => `"${slash(node)}" "${slash(path.join(dir, 'hook.cjs'))}" "${slash(hookCfgFile)}"`;

// A locked or broken file gives a message and false; it never breaks the app start (M8).
function writeJsonSettings(file, mutate, opts) {
  try {
    editJson(file, mutate, opts);
    return true;
  } catch (e) {
    dialog.showErrorBox(
      'Nikki',
      e instanceof SyntaxError ? `${file} ist kein gültiges JSON. Ich ändere daran nichts.` : `Nikki kann ${file} nicht ändern (${e.code ?? e.message}).`,
    );
    return false;
  }
}
// the backup holds the file as it was before Nikki ever touched it
const writeHooks = (mutate) =>
  writeJsonSettings(settingsFile, mutate, { backup: `${settingsFile}.nikki-backup`, pristine: (s) => hookCommandIn(s) === null });

// App start: refresh the command (an update may have moved the app), but only while our hooks are still in there.
// Whoever removed them by hand (/hooks) does not get them back (M6).
async function refreshHooks() {
  let present = true; // a broken file: writeHooks below says so
  try {
    present = hookCommandIn(readJson(settingsFile)) !== null;
  } catch {}
  if (!present) {
    store.hooks = false;
    save();
    return createTray();
  }
  const node = await findNode();
  if (node) writeHooks((s) => withHooks(s, hookCommand(node)));
}

async function setHooks(on) {
  const node = on ? await findNode() : null;
  if (on && !node) {
    dialog.showErrorBox('Nikki', 'Für Terminal-Sessions braucht es Node.js (der Befehl „node“ wurde nicht gefunden).');
    on = false;
  } else if (!writeHooks((s) => (on ? withHooks(s, hookCommand(node)) : withoutHooks(s)))) on = store.hooks;
  store.hooks = on;
  save();
  if (!on) {
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
  feedPointer();
  startHookServer();
  // safety: if the renderer never signals, still allow fullscreen-hide after the intro window
  setTimeout(endBootHold, 5000);
  // a display that went away or changed: put the island back on the display it overlaps most (or the nearest)
  const replace = () => alive() && place(screen.getDisplayMatching(win.getBounds()));
  screen.on('display-removed', replace);
  screen.on('display-metrics-changed', replace);
  // explicit user action: shows the island even over a fullscreen app
  // Ctrl+Alt+Space is often taken (e.g. by Claude Desktop): fall back to Ctrl+Alt+K.
  hotkey = ['Control+Alt+Space', 'Control+Alt+K'].find((k) => globalShortcut.register(k, showNow)) ?? null;
  tray.setToolTip(hotkey ? `Nikki (${hotkey.replace('Control', 'Strg').replace('Space', 'Leertaste')})` : 'Nikki');
  if (storeNotice) dialog.showMessageBox({ type: 'warning', title: 'Nikki', message: storeNotice }).catch(() => {});
  // settings files last: a locked one must not cost the hotkey (M8)
  if (store.hooks) refreshHooks();
  // Cursor support is gone: take our hooks out of ~/.cursor/hooks.json once, then drop the flag
  if (store.cursorHooks && writeJsonSettings(cursorHooksFile, withoutCursorHooks)) {
    delete store.cursorHooks;
    save();
  }
});
app.on('before-quit', () => {
  quitting = true;
  clearInterval(pointerTimer);
  pointerTimer = null;
});
app.on('will-quit', () => {
  quitting = true;
  clearInterval(pointerTimer);
  pointerTimer = null;
  agent.stop();
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
