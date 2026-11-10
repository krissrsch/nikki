import { app, BrowserWindow, clipboard, dialog, globalShortcut, ipcMain, Menu, nativeImage, net, Notification, powerSaveBlocker, protocol, safeStorage, screen, shell, Tray } from 'electron';
import { execFile, spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import { connect as pipeConnect } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import vm from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createClaudeAgent, readLimits } from './backends/claude.js';
import { addClip, removeClip, restoreClips } from './lib/clipboard.js';
import { withoutCursorHooks } from './lib/cursor-migration.js';
import { avatarUrl, createDiscord, DISCORD_REDIRECT, pipePath } from './lib/discord.js';
import { friendlyError } from './lib/errors.js';
import { coversMonitor, fullscreenScript, parseCovered, powershellArgs } from './lib/fullscreen.js';
import { hookCommandIn, withHooks, withoutHooks } from './lib/hooks.js';
import { editJson, readJson, writeJsonAtomic } from './lib/json-file.js';
import { mediaCommand } from './lib/media.js';
import { coverColor } from './lib/cover-color.js';
import { lyricsUrls, pickLyrics } from './lib/lyrics.js';
import { DEFAULT_MODULES, moduleFile, normalizeModules, withNewModules } from './lib/modules.js';
import { createRelay } from './lib/relay.js';
import { formatSize, planAdd, shelfFile } from './lib/shelf.js';
import { onHook, sessionPid, sweep } from './lib/terminal.js';
import { limitWarnings, toUsage } from './lib/usage.js';
import { soundFiles, soundsReadme } from './lib/sounds.js';
import { cleanTranscript, OLD_MODEL, parseVoice, pttKeys, VOICE_ASSETS, VOICE_KEY, webhookOk, whisperArgs, whisperThreads } from './lib/voice.js';
import { forecastUrl, geocodeUrl, parseForecast, parsePlace } from './lib/weather.js';
import { moveDataDir } from './lib/data-dir.js';

const dir = path.dirname(fileURLToPath(import.meta.url));

// Own data folder for dev starts (B3) and for tests (NIKKI_USER_DATA): neither may touch the installed app's chats or hooks.
// Must run before anything asks for userData.
if (process.env.NIKKI_USER_DATA) app.setPath('userData', path.resolve(process.env.NIKKI_USER_DATA));
else if (!app.isPackaged) app.setPath('userData', path.join(app.getPath('appData'), 'Nikki-dev'));
else app.setPath('userData', moveDataDir(app.getPath('appData'), process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude'))); // not the package name
// test runs (NIKKI_MUTE): every window plays its sounds as usual, only nobody hears them
if (process.env.NIKKI_MUTE) app.on('web-contents-created', (_e, wc) => wc.setAudioMuted(true));

// Serve the app from app://bundle/ so fetch() works for the Rive file and wasm (Chromium blocks fetch on file://).
protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
function serveApp(req) {
  const { pathname } = new URL(req.url);
  if (pathname.startsWith('/user-sounds/')) {
    const name = decodeURIComponent(pathname.slice(13));
    if (!Object.values(soundFiles(soundsDir())).includes(name)) return new Response('not found', { status: 404 });
    return net.fetch(pathToFileURL(path.join(soundsDir(), name)).toString());
  }
  const file = path.normalize(path.join(dir, decodeURIComponent(pathname)));
  if (!file.startsWith(dir + path.sep) || !fs.existsSync(file)) return new Response('not found', { status: 404 });
  return net.fetch(pathToFileURL(file).toString());
}
const soundsDir = () => path.join(app.getPath('userData'), 'sounds');
// Claude Code CLI: the native installer's path, else what `where claude` finds (npm, WinGet) (M11).
// Looked up once, not on every get-state (B15); looked up again only while it is missing.
const nativeClaude = path.join(os.homedir(), '.local', 'bin', 'claude.exe');
let claudeLookup = null;
function findClaude(again = false) {
  if (claudeLookup && !again) return claudeLookup;
  claudeLookup = fs.existsSync(nativeClaude)
    ? Promise.resolve(nativeClaude)
    : new Promise((resolve) =>
        execFile('where.exe', ['claude'], { windowsHide: true, timeout: 3000 }, (err, out) => {
          const hits = err ? [] : String(out).split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
          // shortcut: a claude.cmd (npm) goes to the SDK as is, not verified; resolve it to its .exe if that ever fails.
          resolve(hits.find((p) => /\.exe$/i.test(p)) || hits[0] || null);
        }),
      );
  return claudeLookup;
}
const WIDTH = 1200; // open island (720) + its shadow; place() widens the window to the whole display so the glow's hairline runs along the full top edge
const HEIGHT = 640; // the open island grows with its page up to ~580 (Home with three rows) plus its shadow; the rest lets clicks through

// Usage must run on the user's own subscription, never on an API key or another endpoint that happens to be set (N10).
delete process.env.ANTHROPIC_API_KEY;
delete process.env.ANTHROPIC_AUTH_TOKEN;
delete process.env.ANTHROPIC_BASE_URL;

// --- tiny JSON store: recent projects, model per project, chats (each with its own session id)
const storeFile = path.join(app.getPath('userData'), 'state.json');
let store = {
  projects: [],
  models: {},
  chats: [],
  lastChatId: null,
  muted: false,
  hooks: false,
  relay: true, // with hooks on: permissions of terminal sessions are answered in the island, messages can be queued
  hotkey: null, // null: the first free default
  sleepMin: 5, // minutes without activity until Nikki falls asleep in the notch
  showBranch: true,
  modules: DEFAULT_MODULES, // [{ id, on }] in tab order, see lib/modules.js
  keepAwake: false, // by hand: PC and screen stay awake (while our Claude run works they do anyway)
  clipKeep: false, // clipboard module: keep its history on disk (userData/clipboard.json); off, it lives in memory only
  glow: true, // light edge around the closed notch, spectrum with music
  glowLevel: 'normal', // dezent | normal | kraeftig
  hoverOpen: 0, // ms the pointer rests on the closed notch until it opens; 0: only by click
  catJump: true, // Nikki jumps through the tab icons when the page changes
  intro: true, // she arrives with a small show when Nikki starts
  closeKey: null, // closes the open island without focus; held only while it is open
  micSpectrum: false, // the spectrum also hears the microphone; off by default: Windows then shows the mic as in use
  display: null, // id of the display the notch was dragged to
  discord: {}, // { clientId, secret, token, refresh }: the last three sealed with safeStorage, see seal()
  discordJoin: false, // a toast when someone joins the voice channel
  voice: false, // Spracheingabe; switching it on downloads whisper once
  voiceKey: VOICE_KEY, // held while speaking
  voiceHooks: [], // [{ name, url }]: url sealed like the Discord secret
  weatherCity: '', // Home weather tile; '' = none yet
  lang: 'auto', // auto (Windows' language) | de | en
  lyrics: false, // music module: synced lyrics from lrclib.net; off by default, title and artist leave the PC
  weather: null, // last answer for weatherCity, see fetchWeather()
};
const GLOW_LEVELS = ['dezent', 'normal', 'kraeftig'];
let storeNotice = null; // shown once the app is ready
let storeWritable = true; // never overwrite a state.json we could not read: that is how chats got lost (H2)
try {
  const saved = readJson(storeFile, (moved) => (storeNotice = `Nikkis Daten waren beschädigt und wurden nach\n${moved}\nverschoben. Nikki startet mit leerem Stand.`));
  if (saved && typeof saved === 'object') store = { ...store, ...saved };
  store.projects = Array.isArray(store.projects) ? store.projects : [];
  // 1.0 chats from Cursor or Gemini carry a session id Claude does not know
  store.chats = (Array.isArray(store.chats) ? store.chats : []).map((c) => (c?.backend && c.backend !== 'claude' ? { ...c, backend: 'claude', sessionId: null } : c));
  store.lastChatId = store.lastChatId ?? null;
  store.modules = withNewModules(normalizeModules(store.modules));
  delete store.sessions; // 1.0: last session per project, now only chats carry one (N9)
  delete store.backends;
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
    if (!saveFailed && app.isReady()) dialog.showMessageBox({ type: 'warning', title: 'Nikki', message: tr(`Nikki kann nicht speichern: ${e.code ?? e.message}`) }).catch(() => {});
    saveFailed = true; // one message per run of failures, not one per save
  }
}
const MAX_CHATS = 40;
// the general chat runs here, so questions need no project; a folder of its own, because Claude always works in one
const generalDir = path.join(app.getPath('userData'), 'allgemein');
function generalFolder() {
  fs.mkdirSync(generalDir, { recursive: true });
  return generalDir;
}
const addProject = (p) => {
  if (p === generalDir) return; // not a project: it has its own place in the menu
  store.projects = [p, ...store.projects.filter((x) => x !== p)].slice(0, 8);
  save();
};

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

// --- language (setting "Sprache"): auto follows Windows. The renderer translates its DOM itself (renderer/i18n.js);
// main only translates what Windows shows for it (toasts, tray). The translator is the renderer's own, run here in a vm.
const LANGS = ['auto', 'de', 'en'];
const enDict = JSON.parse(fs.readFileSync(path.join(dir, 'i18n', 'en.json'), 'utf8'));
const i18nScope = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(dir, 'renderer', 'i18n.js'), 'utf8'), i18nScope);
const toEnglish = i18nScope.i18nTranslator(enDict);
const lang = () => (store.lang === 'de' || store.lang === 'en' ? store.lang : app.getLocale().toLowerCase().startsWith('de') ? 'de' : 'en');
const tr = (text) => (lang() === 'en' ? toEnglish(text) : text);
// asked once by every window's preload, before its first script runs
ipcMain.on('i18n', (e) => (e.returnValue = lang() === 'en' ? { lang: 'en', dict: enDict } : { lang: 'de', dict: {} }));

// --- toast while the island can't be seen (hidden via tray or behind a fullscreen app); the renderer plays the sound
// force: also while it can be seen (timer ran out, appointment soon): the closed notch is easy to miss
const toasts = new Set();
function notify(body, force = false) {
  if (!alive() || (win.isVisible() && !force) || !Notification.isSupported()) return;
  const n = new Notification({ title: tr(body), silent: true }); // Windows already shows the app name above it (B16)
  // held until it is done: a collected Notification takes its click handler with it (N5)
  toasts.add(n);
  const drop = () => toasts.delete(n);
  n.on('click', () => {
    drop();
    showNow();
  });
  n.on('close', drop);
  n.on('failed', drop);
  n.show();
}

// --- permission requests (also questions and plans) wait for the renderer's answer: { answer, picks?, message? }
const pending = new Map();
// language switched: the island reloads in it only once no task runs and it is closed (its chat is saved by then)
let islandReload = false;
function reloadIslandWhenFree() {
  if (!islandReload || agent.busy() || islandOpen || !alive()) return;
  islandReload = false;
  win.loadURL('app://bundle/renderer/index.html?quiet'); // a query, not a #hash: a hash alone would not load the page again. See startUp()
}
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
    // toast first: once the island is shown again, notify() sees it visible and stays quiet (B11)
    notify(
      req.toolName === 'AskUserQuestion'
        ? 'Der Agent hat eine Frage an dich.'
        : req.toolName === 'ExitPlanMode'
          ? 'Der Plan wartet auf dich.'
          : 'Der Agent braucht eine Erlaubnis.',
    );
    userHidden = false;
    applyVisibility();
  });
}

let activeCwd = null;

const agent = createClaudeAgent({
  askPermission,
  onStatus: (s) => {
    // the CLI's own words (often English) go along as the detail; the island says it in German
    if (s.state === 'error' && 'answer' in s) s = { ...s, answer: friendlyError(s.answer), detail: String(s.answer ?? '') };
    send('status', s);
    agentWorking = !['done', 'error', 'idle'].includes(s.state);
    applyAwake();
    if (!agentWorking) setTimeout(reloadIslandWhenFree, 2000); // after the renderer saved the answer
    const where = activeCwd ? path.basename(activeCwd) : 'Projekt';
    if (s.state === 'done') notify(`Fertig in ${where}.`);
    if (s.state === 'error') notify(`Fehler in ${where}.`);
  },
  onSession: (sid) => send('session', { id: sid, cwd: activeCwd }),
});

// --- keep the PC awake: on its own while our Claude run works (the system may not sleep, the screen may go off),
// by hand from the settings (the screen stays on too)
let agentWorking = false;
let awake = { id: null, type: null };
function applyAwake() {
  const type = store.keepAwake ? 'prevent-display-sleep' : agentWorking ? 'prevent-app-suspension' : null;
  if (type === awake.type) return;
  if (awake.id !== null) powerSaveBlocker.stop(awake.id);
  awake = { id: type ? powerSaveBlocker.start(type) : null, type };
}

// --- the island sits at the top-center of one display: the one it was dragged to (else the primary) at start, the mouse pointer's one when opened
function place(display) {
  if (!alive()) return;
  const { bounds } = display;
  try {
    win.setBounds({ x: bounds.x, y: bounds.y, width: Math.max(WIDTH, bounds.width), height: HEIGHT });
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
    show: false, // applyVisibility() shows it without taking focus, once it is clear no fullscreen app is in front (B9)
    // sounds must play without a click: the chime is the point when the island is hidden
    // paintWhenInitiallyHidden: false keeps document.visibilityState 'hidden' until shown; the renderer waits for it before the intro
    webPreferences: { preload: path.join(dir, 'preload.cjs'), autoplayPolicy: 'no-user-gesture-required', paintWhenInitiallyHidden: false },
  });
  // a crashed renderer (GPU): load it again, and nothing waits for an answer it can no longer give (N11)
  win.webContents.on('render-process-gone', (_e, details) => {
    for (const finish of [...pending.values()]) finish({ answer: 'deny' });
    islandOpen = notchDragging = false;
    syncCloseKey();
    if (!quitting && details.reason !== 'clean-exit') win.webContents.reload();
  });
  // clear timers before will-quit — destroy races the pointer tick otherwise
  win.on('closed', () => {
    clearInterval(pointerTimer);
    pointerTimer = null;
    win = null;
  });
  place(screen.getAllDisplays().find((d) => d.id === store.display) ?? screen.getPrimaryDisplay());
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setIgnoreMouseEvents(true, { forward: true });
  // links in answers open in the browser; the island itself never navigates (e.g. on a stray file drop)
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  win.loadURL('app://bundle/renderer/index.html');
}

// --- visibility: hidden by the user (tray) or while a fullscreen app (game, video) is in front
let userHidden = false;
// null until the watcher first answers: started over a game, Nikki stays hidden and takes no focus till it ends (B9)
let fullscreen = null;
function applyVisibility() {
  if (!alive()) return;
  try {
    const show = !userHidden && fullscreen === false;
    if (show && !win.isVisible()) win.showInactive();
    if (!show && win.isVisible()) win.hide();
  } catch {}
  syncSpectrum();
  syncCloseKey();
}
// view: the page the island opens on (tray "Einstellungen"), else it keeps the last one
function showNow(view) {
  if (!alive()) return;
  try {
    userHidden = false;
    const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
    if (display.id !== screen.getDisplayMatching(win.getBounds()).id) place(display);
    win.show();
    win.focus();
    syncCloseKey();
  } catch {
    return;
  }
  // Always expand — toggle would collapse an already-open island (tray / hotkey / toast)
  send('show', view);
}

// Once a second the watcher says which monitors have a fullscreen window (lib/fullscreen.js). It only counts if it is the island's
// own monitor, whether or not the game has the focus. Exits on its own once the app is gone.
let fullscreenWatcher;
let watcherDelay = 1000;
function setFullscreen(on) {
  if (on === fullscreen) return;
  fullscreen = on;
  applyVisibility();
}
function watchFullscreen() {
  if (quitting) return;
  // e2e runs (NIKKI_NO_FULLSCREEN): a video the user watches meanwhile would hide the island in the middle of a test.
  // No watcher means no fullscreen, said once: the island stays hidden while fullscreen is still unknown (null)
  if (process.env.NIKKI_NO_FULLSCREEN) return setFullscreen(false);
  const ps = (fullscreenWatcher = spawn('powershell.exe', powershellArgs(fullscreenScript(process.pid)), { windowsHide: true }));
  ps.stdout.on('data', (d) => {
    if (quitting || !alive()) return;
    watcherDelay = 1000;
    const line = d.toString().split(/\r?\n/).filter((l) => l !== '').pop() ?? '';
    const mine = screen.dipToScreenRect(null, screen.getDisplayMatching(win.getBounds()).bounds);
    setFullscreen(coversMonitor(parseCovered(line), mine));
  });
  // a dead watcher (blocked PowerShell, killed) must not leave the island hidden for good: assume no fullscreen, retry later (M9)
  let gone = false;
  const restart = () => {
    if (gone || quitting) return;
    gone = true;
    setFullscreen(false);
    setTimeout(watchFullscreen, watcherDelay);
    watcherDelay = Math.min(watcherDelay * 2, 60 * 1000);
  };
  ps.on('error', restart);
  ps.on('exit', restart);
}

// --- the closed notch is dragged by the renderer inside the window; the window follows the pointer to the next display
let notchDragging = false;
function moveToPointerDisplay() {
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  if (display.id !== screen.getDisplayMatching(win.getBounds()).id) place(display);
  return display;
}
ipcMain.on('notch-drag', (_e, on) => {
  notchDragging = on;
  if (on || !alive()) return;
  store.display = moveToPointerDisplay().id;
  save();
});

// --- mouse pointer position (window-relative) for the companion's eyes; only while visible and only on change
let lastPointer = '';
let pointerTimer;
function feedPointer() {
  if (process.env.NIKKI_NO_POINTER) return; // e2e runs place the pointer themselves; a real mouse moving meanwhile would spoil them
  // 50ms was chatty for eye-tracking + click-through hit tests; 100ms is plenty
  pointerTimer = setInterval(() => {
    try {
      if (!alive() || !win.isVisible()) return;
      const p = screen.getCursorScreenPoint();
      if (notchDragging) moveToPointerDisplay();
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
// never steal focus from a fullscreen app or while hidden (B9)
ipcMain.on('focus', () => alive() && win.isVisible() && fullscreen === false && win.focus());
// --- settings page in the island; every setter returns the whole set again (+ error for a hotkey that did not take)
const settings = async () => ({
  autostart: app.getLoginItemSettings().openAtLogin,
  autostartAvailable: app.isPackaged, // in dev this would register electron.exe
  hotkey,
  muted: !!store.muted,
  sleepMin: store.sleepMin,
  hooks: !!store.hooks,
  relay: store.relay !== false,
  claudePath: await findClaude(),
  showBranch: store.showBranch !== false,
  modules: store.modules,
  keepAwake: !!store.keepAwake,
  glow: store.glow !== false,
  catJump: store.catJump !== false,
  hoverOpen: store.hoverOpen ?? 0,
  version: app.getVersion(),
  dataDir: app.getPath('userData'),
  intro: store.intro !== false,
  closeKey: store.closeKey ?? null,
  micSpectrum: !!store.micSpectrum,
  discordId: store.discord?.clientId ?? '',
  discordSecretSet: !!store.discord?.secret,
  discordJoin: !!store.discordJoin,
  voice: !!store.voice,
  voiceKey: store.voiceKey,
  voiceSetup,
  voiceHooks: voiceHooks().map((h) => h.name),
  glowLevel: GLOW_LEVELS.includes(store.glowLevel) ? store.glowLevel : 'normal',
  weatherCity: typeof store.weatherCity === 'string' ? store.weatherCity : '',
  lyrics: !!store.lyrics,
  lang: LANGS.includes(store.lang) ? store.lang : 'auto',
});
ipcMain.handle('settings-get', settings);
// the settings live in their own normal window; closing it changes nothing else
let settingsWin = null;
function openSettings(page = 'general') {
  if (settingsWin) {
    settingsWin.webContents.send('settings-page', page);
    settingsWin.show();
    return settingsWin.focus();
  }
  settingsWin = new BrowserWindow({
    width: 860,
    height: 600,
    minWidth: 700,
    minHeight: 460,
    title: tr('Nikki Einstellungen'),
    icon: path.join(dir, 'assets', 'icon.png'),
    backgroundColor: '#0c0d10',
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#0c0d10', symbolColor: '#a3a3ad', height: 36 },
    show: false,
    webPreferences: { preload: path.join(dir, 'preload.cjs') },
  });
  settingsWin.once('ready-to-show', () => settingsWin.show());
  settingsWin.on('closed', () => (settingsWin = null));
  settingsWin.loadFile(path.join(dir, 'renderer', 'settings.html'), { hash: page });
}
ipcMain.on('open-settings', (_e, page) => openSettings(page));
ipcMain.on('open-data-dir', () => shell.openPath(app.getPath('userData')));
ipcMain.handle('settings-set', async (_e, key, value) => {
  let error = null;
  if (key === 'autostart' && app.isPackaged) app.setLoginItemSettings({ openAtLogin: !!value });
  else if (key === 'hotkey') error = setHotkey(String(value));
  else if (key === 'closeKey') error = setCloseKey(String(value ?? ''));
  else if (key === 'discordId') error = setDiscord({ clientId: String(value ?? '').trim() });
  else if (key === 'discordSecret') error = setDiscord({ secret: String(value ?? '').trim() });
  else if (key === 'discordJoin') store.discordJoin = !!value;
  else if (key === 'voice') {
    store.voice = !!value;
    syncHelper();
    syncVoice();
    if (store.voice) voiceInstall();
  } else if (key === 'voiceKey') {
    if (!pttKeys(value)) error = 'invalid';
    else if (value === hotkey || value === store.closeKey) error = 'taken';
    else {
      store.voiceKey = String(value);
      syncVoice();
    }
  } else if (key === 'hookAdd') error = addVoiceHook(value);
  else if (key === 'hookRemove') store.voiceHooks = voiceHooks().filter((h) => h.name !== value);
  else if (key === 'muted') store.muted = !!value;
  else if (key === 'sleepMin') store.sleepMin = Math.min(120, Math.max(1, Math.round(Number(value)) || 5));
  else if (key === 'hooks') {
    await setHooks(!!value);
    syncHelper(); // the jump into a terminal needs the helper
  }
  else if (key === 'relay') {
    store.relay = !!value;
    if (store.hooks) await setHooks(true); // rewrite our hooks with or without the waiting ones
    if (!store.relay) relay.cancelAll();
  }
  else if (key === 'showBranch') store.showBranch = !!value;
  else if (key === 'modules') {
    store.modules = normalizeModules(value, store.modules);
    syncHelper();
    syncLyrics();
    syncToasts();
    syncClipboard();
    syncDiscord();
  } else if (key === 'keepAwake') {
    store.keepAwake = !!value;
    applyAwake();
  } else if (key === 'catJump') store.catJump = !!value;
  else if (key === 'hoverOpen' && [0, 300, 600, 1000].includes(value)) store.hoverOpen = value;
  else if (key === 'intro') store.intro = !!value;
  else if (key === 'catPlaces') win?.webContents.send('cat-reset'); // her places live in the island's renderer
  else if (key === 'glow') {
    store.glow = !!value;
    syncHelper();
    syncSpectrum();
  } else if (key === 'micSpectrum') {
    store.micSpectrum = !!value;
    syncSpectrum();
  } else if (key === 'glowLevel' && GLOW_LEVELS.includes(value)) store.glowLevel = value;
  else if (key === 'lang' && LANGS.includes(value) && value !== store.lang) {
    store.lang = value;
    save();
    createTray(); // its menu in the new language
    for (const w of BrowserWindow.getAllWindows()) if (w !== win) w.webContents.reload(); // settings and the voice capsule start over in it
    islandReload = true;
    reloadIslandWhenFree();
    return { ...(await settings()), error };
  } else if (key === 'lyrics') {
    store.lyrics = !!value;
    syncLyrics();
  }
  else if (key === 'weatherCity') {
    const city = String(value ?? '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 80);
    if (city !== store.weatherCity) {
      store.weatherCity = city;
      fetchWeather();
    }
  }
  save();
  const all = await settings();
  for (const w of BrowserWindow.getAllWindows()) w.webContents.send('settings-changed', all); // the island and the settings window
  return { ...all, error };
});
ipcMain.handle('get-state', async () => ({
  ...store,
  general: generalFolder(),
  claudeFound: !!(await findClaude()),
  terminal: [...terminal.values()],
}));
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
ipcMain.handle('start', async (_e, { prompt, cwd, newSession, plan, model, sessionId }) => {
  const claudePath = (await findClaude()) ?? (await findClaude(true));
  if (agent.busy() || !prompt.trim() || !cwd || !fs.existsSync(cwd) || !claudePath) return false;
  activeCwd = cwd;
  addProject(cwd);
  setModel(cwd, model);
  save();
  // only the chat's own session: no fallback to whatever ran last in this project (N9)
  return agent.start(prompt, cwd, newSession ? undefined : sessionId || undefined, { plan, model: model ?? undefined, claudePath });
});
// --- module data: userData/modules/<id>.json, written atomically; the id is checked in moduleFile (no path from the renderer)
const modulesDir = path.join(app.getPath('userData'), 'modules');
const unreadable = new Set(); // never overwrite module data we could not read (H2)
const warn = (message) => dialog.showMessageBox({ type: 'warning', title: 'Nikki', message: tr(message) }).catch(() => {});
ipcMain.handle('module-get', (_e, id) => {
  const file = moduleFile(modulesDir, id);
  try {
    const data = readJson(file, (moved) => warn(`Die Daten von „${id}“ waren beschädigt und liegen jetzt unter\n${moved}\nDas Modul startet leer.`));
    unreadable.delete(id);
    return data ?? null;
  } catch (e) {
    unreadable.add(id);
    warn(`Nikki kann ${file} nicht lesen (${e.code ?? e.message}). Bis zum Neustart speichert „${id}“ nichts.`);
    throw e;
  }
});
const moduleWriteFailed = new Set(); // one message per module and run of failures
ipcMain.handle('module-set', (_e, id, data) => {
  const file = moduleFile(modulesDir, id);
  if (unreadable.has(id)) return false;
  try {
    writeJsonAtomic(file, data ?? null);
    moduleWriteFailed.delete(id);
    return true;
  } catch (e) {
    console.error(file, e);
    if (!moduleWriteFailed.has(id)) warn(`Nikki kann „${id}“ nicht speichern: ${e.code ?? e.message}`);
    moduleWriteFailed.add(id);
    return false;
  }
});
// --- Windows helper (helper/NikkiHelper.exe, JSON lines over stdio): what plays (SMTC) and the system volume.
// Runs only while the music module is on; a crash restarts it with backoff, like the fullscreen watcher.
// NIKKI_NO_HELPER (e2e runs): never read the user's real media session or touch the volume.
const helperExe = path.join(dir, 'helper', 'NikkiHelper.exe');
let helper = null;
let helperDelay = 1000;
let helperBuild = null; // dev: build.cmd runs once when the exe is missing
let mediaNow = null; // { app, title, artist, album, status, position, duration, updatedAt, cover: data URL | '', color: '#rrggbb' | '' } | null
let volumeNow = null; // { level 0-100, muted } | null
// the spectrum needs the helper too, with or without the music module
const helperWanted = () => !process.env.NIKKI_NO_HELPER && !quitting && (store.glow !== false || store.voice || store.hooks || store.modules.some((m) => m.id === 'music' && m.on) || toastsOn());
function syncHelper() {
  if (helperWanted()) startHelper();
  else stopHelper();
}
function startHelper() {
  if (helper) return;
  if (!fs.existsSync(helperExe)) {
    if (!app.isPackaged && !helperBuild)
      helperBuild = new Promise((resolve) =>
        execFile('cmd.exe', ['/c', path.join(dir, 'helper', 'build.cmd')], { windowsHide: true, timeout: 120000 }, (err, out) => {
          if (err) console.error('helper build:', err.message, String(out));
          resolve();
        }),
      ).then(syncHelper);
    return;
  }
  const born = Date.now();
  const p = (helper = spawn(helperExe, [], { windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'] }));
  p.stdin.on('error', () => {}); // a command sent while it dies must not take main down (EPIPE)
  readline.createInterface({ input: p.stdout, crlfDelay: Infinity }).on('line', onHelperLine);
  spectrumSent = micSent = pttSent = toastsSent = null; // a new helper starts with its spectrum off
  syncSpectrum();
  syncVoice();
  syncToasts();
  let gone = false;
  const restart = () => {
    if (gone) return;
    gone = true;
    if (helper === p) helper = null;
    if (!helper) {
      // switched off and on quickly: the new helper's news stays
      mediaNow = volumeNow = null;
      send('media', null);
      syncLyrics();
      send('volume', null);
      sendSpectrum(null);
    }
    if (p.stopped || !helperWanted()) return;
    // a helper that ran a while starts over quickly; one that dies at once waits longer each time
    helperDelay = Date.now() - born > 30000 ? 1000 : Math.min(helperDelay * 2, 60000);
    setTimeout(syncHelper, helperDelay);
  };
  p.on('error', restart);
  p.on('exit', restart);
}
function stopHelper() {
  if (!helper) return;
  helper.stopped = true;
  helper.kill();
  helper = null;
}
// The cover reaches the renderer as a data URL of at most 256 px, never as a path; nativeImage only decodes real images.
// Its colour (lib/cover-color.js) tints the glow and the music tile; '' keeps the glow's own blue.
let coverCache = { file: '', url: '', color: '' };
function cover(file) {
  if (!file || path.basename(path.dirname(file)) !== 'nikki-covers') return { url: '', color: '' };
  if (coverCache.file !== file) {
    const img = nativeImage.createFromPath(file);
    const { width, height } = img.getSize();
    const small = width > 256 || height > 256 ? img.resize(width >= height ? { width: 256 } : { height: 256 }) : img;
    coverCache = img.isEmpty()
      ? { file, url: '', color: '' }
      : { file, url: `data:image/jpeg;base64,${small.toJPEG(85).toString('base64')}`, color: coverColor(small.toBitmap()) }; // a PNG is ~8x bigger
  }
  return coverCache;
}
function onHelperLine(line) {
  let m;
  try {
    m = JSON.parse(line);
  } catch {
    return;
  }
  if (m.type === 'media') {
    const { app: player, title, artist, album, status, position, duration, updatedAt } = m;
    const { url, color } = m.active ? cover(m.cover) : {};
    mediaNow = m.active ? { app: player, title, artist, album, status, position, duration, updatedAt, cover: url, color } : null;
    send('media', mediaNow);
    syncLyrics();
  } else if (m.type === 'volume') send('volume', (volumeNow = { level: m.level, muted: !!m.muted }));
  else if (m.type === 'spectrum' && Array.isArray(m.bands) && m.bands.length === 12) sendSpectrum(m.bands.map((v) => Math.min(1, Math.max(0, Number(v) || 0))));
  else if (m.type === 'ptt') m.down ? voiceDown() : voiceUp();
  else if (m.type === 'rec') voiceHeard(m.ms);
  else if (m.type === 'voice' && Array.isArray(m.bands)) pill?.webContents.send('pill-bands', m.bands);
  else if (m.type === 'focus' && !m.ok) notify(NO_TERMINAL, true);
  else if (m.type === 'toasts') setToasts({ ...inbox, access: !!m.ok });
  else if (m.type === 'toast') addToast(m);
  else if (m.type === 'error') console.error('helper:', m.message);
}
// --- spectrum for the glow: the helper listens to what plays (WASAPI loopback) only while someone can see it:
// glow on, the island not hidden; the microphone joins in only when switched on in the settings
let spectrumSent = null; // 'on' | 'off', last told to this helper
let micSent = null;
function syncSpectrum() {
  if (!helper) return;
  const want = store.glow !== false && alive() && win.isVisible() ? 'on' : 'off';
  const mic = (want === 'on' && store.micSpectrum) || voiceState === 'listening' ? 'on' : 'off';
  if (mic !== micSent) helper.stdin.write(`mic ${(micSent = mic)}\n`);
  if (want === spectrumSent) return;
  spectrumSent = want;
  helper.stdin.write(`spectrum ${want}\n`);
  if (want === 'off') sendSpectrum(null);
}
// at most one frame per 30 ms to the renderer, always the latest (the helper's last zeros must arrive)
let spectrumLast = 0;
let spectrumTimer = null;
let spectrumNext = null;
function sendSpectrum(bands) {
  spectrumNext = bands;
  spectrumTimer ??= setTimeout(() => {
    spectrumTimer = null;
    spectrumLast = Date.now();
    send('spectrum', spectrumNext);
  }, Math.max(0, 30 - (Date.now() - spectrumLast)));
}
ipcMain.handle('media-get', () => ({ media: mediaNow, volume: volumeNow, lyrics: lyricsNow }));
ipcMain.on('media-cmd', (_e, cmd, value) => {
  const line = mediaCommand(cmd, value);
  if (line && helper) helper.stdin.write(`${line}\n`);
});

// --- Mitteilungen (module "notifications", opt-in): the helper reads other apps' Windows notifications while it is on.
// The last 30, in memory only; switched off they are forgotten.
let inbox = { access: null, items: [] };
let toastsSent = null; // 'on' | 'off', last told to this helper
const toastsOn = () => !quitting && store.modules.some((m) => m.id === 'notifications' && m.on);
function setToasts(next) {
  inbox = next;
  send('toasts', inbox);
}
function syncToasts() {
  const want = toastsOn() ? 'on' : 'off';
  if (want === 'off' && inbox.items.length) setToasts({ access: inbox.access, items: [] });
  if (!helper || want === toastsSent) return;
  helper.stdin.write(`toasts ${(toastsSent = want)}\n`);
}
const clip = (v, n) => String(v ?? '').replace(/[\u0000-\u0008\u000b-\u001f]/g, '').trim().slice(0, n);
function addToast(m) {
  const t = { id: Number(m.id) || 0, app: clip(m.app, 60), title: clip(m.title, 200), body: clip(m.body, 600), at: Date.now() };
  if (!toastsOn() || t.app === 'Nikki' || (!t.title && !t.body)) return; // Nikki's own toasts are already in the island
  setToasts({ access: true, items: [t, ...inbox.items.filter((x) => x.id !== t.id)].slice(0, 30) });
}
ipcMain.handle('toasts-get', () => inbox);
ipcMain.handle('toasts-clear', () => (setToasts({ access: inbox.access, items: [] }), inbox));

// --- lyrics (lib/lyrics.js): LRCLIB, only with Songtexte and the music module on. One fetch per song, kept in memory.
const lyricsCache = new Map(); // [artist, title, album, length] as JSON -> lines | null (none found)
let lyricsNow = null; // { title, artist, lines } for the song that plays
let lyricsFor = ''; // the song asked for last; a position update of the same song asks nothing
async function syncLyrics() {
  const m = mediaNow;
  const on = store.lyrics && store.modules.some((x) => x.id === 'music' && x.on);
  const key = on && m?.title ? JSON.stringify([m.artist, m.title, m.album, Math.round(m.duration || 0)]) : '';
  if (key === lyricsFor) return;
  lyricsFor = key;
  if (lyricsNow) send('lyrics', (lyricsNow = null));
  if (!key) return;
  let lines = lyricsCache.get(key);
  if (lines === undefined) {
    lines = null;
    let failed = null;
    for (const url of lyricsUrls(m)) {
      try {
        const r = await net.fetch(url, { headers: { 'User-Agent': `Nikki/${app.getVersion()} (https://github.com/krissrsch/nikki)` }, signal: AbortSignal.timeout(10000) });
        if (r.status === 404) continue;
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        if ((lines = pickLyrics(await r.json(), m.duration))) break;
      } catch (e) {
        failed = e; // get failed: search may still find it
      }
    }
    if (!lines && failed) {
      console.error('lyrics:', failed.message); // offline: this song stays without and is not cached, the next one asks again
      return;
    }
    lyricsCache.set(key, lines);
    if (lyricsCache.size > 200) lyricsCache.delete(lyricsCache.keys().next().value);
  }
  if (lyricsFor !== key || !lines) return; // another song meanwhile, or none found
  send('lyrics', (lyricsNow = { title: m.title, artist: m.artist, lines }));
}

// --- Discord (lib/discord.js): runs while the module is on and a client id is set; secret and tokens never leave main
let discord = null;
let discordFor = null; // the client id it runs with
let discordNow = { status: 'off', channel: null, people: [], error: null };
const seal = (text) => safeStorage.encryptString(text).toString('base64');
function unseal(text) {
  try {
    return text ? safeStorage.decryptString(Buffer.from(text, 'base64')) : null;
  } catch {
    return null;
  }
}
const avatars = new Map(); // url -> data URL | '' while it loads or when it failed
function avatarOf({ id, avatar }) {
  const url = avatarUrl(id, avatar);
  if (!url) return null;
  if (!avatars.has(url)) {
    avatars.set(url, '');
    net.fetch(url)
      .then((r) => (r.ok ? r.arrayBuffer() : null))
      .then((buf) => {
        const img = buf && nativeImage.createFromBuffer(Buffer.from(buf));
        if (!img || img.isEmpty()) return;
        avatars.set(url, img.toDataURL());
        sendDiscord(discordNow);
      })
      .catch(() => {});
  }
  return avatars.get(url) || null;
}
function sendDiscord(state) {
  discordNow = state;
  send('discord', { ...state, people: state.people.map((p) => ({ ...p, avatar: avatarOf(p) })) });
}
async function discordToken(params) {
  const { clientId, secret } = store.discord;
  const r = await net.fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, client_secret: unseal(secret) ?? '', ...params }).toString(),
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok || !json.access_token) throw new Error(json.error === 'invalid_client' ? 'Client-ID oder Secret stimmen nicht.' : 'Discord hat die Freigabe abgelehnt. Prüf die Redirect-URL deiner App.');
  store.discord = { ...store.discord, token: seal(json.access_token), refresh: json.refresh_token ? seal(json.refresh_token) : null };
  save();
  return json.access_token;
}
const discordTokens = {
  get: () => unseal(store.discord?.token),
  exchange: (code) => discordToken({ grant_type: 'authorization_code', code, redirect_uri: DISCORD_REDIRECT }),
  refresh: () => discordToken({ grant_type: 'refresh_token', refresh_token: unseal(store.discord?.refresh) ?? '' }),
  clear() {
    store.discord = { ...store.discord, token: null, refresh: null };
    save();
  },
};
function syncDiscord() {
  const moduleOn = !quitting && store.modules.some((m) => m.id === 'discord' && m.on);
  const clientId = store.discord?.clientId;
  const wanted = moduleOn && clientId && store.discord?.secret ? clientId : null;
  if (wanted !== discordFor) {
    discord?.stop();
    discord = null;
    discordFor = wanted;
    if (wanted) discord = createDiscord({ clientId: wanted, connect: (n) => pipeConnect(pipePath(n)), tokens: discordTokens, onState: sendDiscord, onJoin: (name) => store.discordJoin && notify(`${name} ist im Sprachkanal`, true) });
  }
  if (!discord) sendDiscord({ status: moduleOn ? 'setup' : 'off', channel: null, people: [], error: null });
}
// a new app or secret starts over: old tokens belong to the old one
function setDiscord(change) {
  if (change.clientId !== undefined && change.clientId && !/^\d{5,30}$/.test(change.clientId)) return 'invalid';
  if (change.secret !== undefined && change.secret.length > 200) return 'invalid';
  if (change.secret && !safeStorage.isEncryptionAvailable()) return 'nocrypt';
  const next = { ...store.discord, token: null, refresh: null };
  if (change.clientId !== undefined) next.clientId = change.clientId;
  if (change.secret !== undefined) next.secret = change.secret ? seal(change.secret) : null;
  store.discord = next;
  discord?.stop();
  discord = discordFor = null;
  syncDiscord();
  return null;
}
ipcMain.handle('discord-get', () => ({ ...discordNow, people: discordNow.people.map((p) => ({ ...p, avatar: avatarOf(p) })) }));
ipcMain.on('discord-authorize', () => discord?.authorize());

// --- Spracheingabe: hold the key, speak, let go. The helper records, whisper.cpp writes it down, lib/voice.js says what it means.
const voiceDir = path.join(app.getPath('userData'), 'voice');
const whisperExe = path.join(voiceDir, 'Release', 'whisper-cli.exe');
const voiceModelFile = VOICE_ASSETS[1].file;
const whisperModelNew = path.join(voiceDir, voiceModelFile);
const whisperModelOld = path.join(voiceDir, OLD_MODEL);
const whisperModel = () => (fs.existsSync(whisperModelNew) ? whisperModelNew : whisperModelOld);
const voiceWav = path.join(voiceDir, 'take.wav');
const VOICE_MIN_MS = 350;
const VOICE_MAX_MS = 60000;
const voiceInstalled = () => fs.existsSync(whisperExe) && fs.existsSync(whisperModel());
const voiceComplete = () => fs.existsSync(whisperExe) && fs.existsSync(whisperModelNew);
let voiceSetup = { state: voiceInstalled() ? 'ready' : 'idle', percent: 0 }; // idle | loading | ready | error
let voiceState = 'idle'; // idle | listening | thinking
let voiceStop = null;
let voiceLoading = false;
let pttSent = null;
let pill = null;
let pillTimer = null;
const voiceHooks = () => (Array.isArray(store.voiceHooks) ? store.voiceHooks : []);
function tellSettings() {
  settings().then((all) => {
    for (const w of BrowserWindow.getAllWindows()) w.webContents.send('settings-changed', all);
  });
}
function addVoiceHook(value) {
  const name = String(value?.name ?? '').replace(/\s+/g, ' ').trim().slice(0, 40);
  const url = String(value?.url ?? '').trim();
  if (!name || !webhookOk(url)) return 'invalid';
  if (!safeStorage.isEncryptionAvailable()) return 'nocrypt';
  store.voiceHooks = [...voiceHooks().filter((h) => h.name.toLowerCase() !== name.toLowerCase()), { name, url: seal(url) }];
  return null;
}
function pillShow(state) {
  clearTimeout(pillTimer);
  if (!pill) {
    pill = new BrowserWindow({ width: 420, height: 56, transparent: true, backgroundColor: '#00000000', frame: false, resizable: false, movable: false, focusable: false, skipTaskbar: true, hasShadow: false, show: false, webPreferences: { preload: path.join(dir, 'preload.cjs') } });
    pill.setAlwaysOnTop(true, 'screen-saver');
    pill.setIgnoreMouseEvents(true);
    pill.on('closed', () => (pill = null));
    pill.loadFile(path.join(dir, 'renderer', 'pill.html'));
  }
  const { workArea: a } = screen.getDisplayMatching(win.getBounds());
  pill.setBounds({ x: Math.round(a.x + (a.width - 420) / 2), y: a.y + a.height - 72, width: 420, height: 56 });
  const say = () => pill?.webContents.send('pill', state);
  if (pill.webContents.isLoading()) pill.webContents.once('did-finish-load', say);
  else say();
  pill.showInactive();
}
function pillDone(text, tone = '') {
  pillShow({ phase: 'message', text, tone });
  pillTimer = setTimeout(() => {
    pill?.webContents.send('pill', { phase: 'hidden' });
    pill?.hide();
  }, 2400);
}
function setVoice(state) {
  voiceState = state;
  send('voice', state === 'listening');
  syncSpectrum();
}
function voiceDown() {
  if (voiceState !== 'idle' || !helper || !alive()) return;
  if (!store.voice) return pillDone('Spracheingabe ist aus. Schalte sie unter Einstellungen, Sprache ein.', 'bad');
  if (!voiceInstalled()) return pillDone(voiceSetup.state === 'error' ? 'Einrichten hat nicht geklappt. Schalte sie aus und wieder ein.' : `Wird noch eingerichtet, ${voiceSetup.percent} %`, 'bad');
  fs.rmSync(voiceWav, { force: true });
  setVoice('listening');
  helper.stdin.write(`rec start ${voiceWav}\n`);
  voiceStop = setTimeout(voiceUp, VOICE_MAX_MS);
  pillShow({ phase: 'listening' });
}
function voiceUp() {
  if (voiceState !== 'listening') return;
  clearTimeout(voiceStop);
  setVoice('thinking');
  pillShow({ phase: 'thinking' });
  helper?.stdin.write('rec stop\n');
}
function voiceHeard(ms) {
  if (voiceState !== 'thinking') return;
  if (ms < VOICE_MIN_MS) {
    setVoice('idle');
    return pillDone('Nichts gehört. Halt die Taste beim Sprechen.', 'bad');
  }
  const started = Date.now();
  execFile(whisperExe, whisperArgs(whisperModel(), voiceWav, voiceHooks().map((h) => h.name), { ms, threads: whisperThreads(os.availableParallelism()) }), { cwd: path.dirname(whisperExe), windowsHide: true, timeout: 60000, encoding: 'utf8', maxBuffer: 1024 * 1024 }, (err, out) => {
    console.log(`voice: ${ms} ms gesprochen, ${Date.now() - started} ms erkannt`);
    fs.rmSync(voiceWav, { force: true });
    setVoice('idle');
    if (err) {
      console.error('whisper:', err.message);
      return pillDone('Das konnte Nikki nicht verstehen.', 'bad');
    }
    const text = cleanTranscript(out);
    if (!text) return pillDone('Nichts verstanden.', 'bad');
    voiceAct(parseVoice(text, voiceHooks().map((h) => h.name)));
  });
}
async function voiceAct(said) {
  if (said.kind === 'unclear') return pillDone(said.text, 'bad');
  if (said.kind !== 'webhook') {
    send('voice-text', said);
    return pill?.webContents.send('pill', { phase: 'hidden' }), pill?.hide();
  }
  const url = unseal(voiceHooks().find((h) => h.name === said.name)?.url);
  try {
    if (!url || !webhookOk(url)) throw new Error('webhook');
    const r = await net.fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: said.text.slice(0, 2000), allowed_mentions: { parse: [] } }) });
    if (!r.ok) throw new Error(`webhook ${r.status}`);
    pillDone(`An ${said.name} gesendet`);
  } catch (e) {
    console.error(e.message);
    pillDone(`${said.name} ist nicht angekommen.`, 'bad');
  }
}
ipcMain.on('voice-note', (_e, text, bad) => pillDone(String(text ?? '').slice(0, 120), bad ? 'bad' : ''));
// the key is watched even while voice is off: a press then says why nothing happens. The microphone only opens when voice is on.
function syncVoice() {
  if (!helper) return;
  const want = `ptt ${pttKeys(store.voiceKey)?.join(',') ?? 'off'}`;
  if (want === pttSent) return;
  pttSent = want;
  helper.stdin.write(`${want}\n`);
}
// One file: streamed to .part, the hash checked, then renamed; nothing unverified ever stays
async function voiceFetch({ file, url, sha256 }, done, total) {
  const to = path.join(voiceDir, file);
  const part = `${to}.part`;
  const r = await net.fetch(url);
  if (!r.ok) throw new Error(`${file}: ${r.status}`);
  const hash = crypto.createHash('sha256');
  const out = fs.createWriteStream(part);
  let got = 0;
  let last = -1;
  try {
    for await (const chunk of r.body) {
      hash.update(chunk);
      got += chunk.length;
      if (!out.write(chunk)) await new Promise((ok) => out.once('drain', ok));
      const percent = Math.floor(((done + got) / total) * 100);
      if (percent !== last) {
        voiceSetup = { state: 'loading', percent: (last = percent) };
        tellSettings();
      }
    }
  } finally {
    await new Promise((ok) => out.end(ok));
  }
  if (hash.digest('hex') !== sha256) {
    fs.rmSync(part, { force: true });
    throw new Error(`${file}: Prüfsumme stimmt nicht`);
  }
  fs.renameSync(part, to);
}
async function voiceInstall() {
  if (voiceLoading || voiceComplete()) return;
  voiceLoading = true;
  try {
    fs.mkdirSync(voiceDir, { recursive: true });
    // what is still missing: the program once (its zip is deleted after unpacking), the model
    const missing = VOICE_ASSETS.filter((a) => !fs.existsSync(path.join(voiceDir, a.file)) && !(a.file === 'whisper.zip' && fs.existsSync(whisperExe)));
    const total = missing.reduce((n, a) => n + a.size, 0);
    let done = 0;
    for (const a of missing) {
      await voiceFetch(a, done, total);
      done += a.size;
    }
    const zip = path.join(voiceDir, 'whisper.zip');
    // Windows' own tar: one from Git on the PATH reads C: as a remote host
    const tar = path.join(process.env.SystemRoot ?? 'C:\Windows', 'System32', 'tar.exe');
    if (fs.existsSync(zip)) {
      await new Promise((ok, fail) => execFile(tar, ['-xf', zip, '-C', voiceDir], { windowsHide: true, timeout: 60000 }, (e) => (e ? fail(e) : ok())));
      fs.rmSync(zip, { force: true });
    }
    if (!voiceComplete()) throw new Error('whisper-cli oder Modell fehlt');
    fs.rmSync(whisperModelOld, { force: true });
    voiceSetup = { state: 'ready', percent: 100 };
    syncVoice();
  } catch (e) {
    console.error('voice setup:', e.message);
    voiceSetup = { state: 'error', percent: 0 };
  }
  voiceLoading = false;
  tellSettings();
}

// --- shelf (Ablage): copies in userData/shelf, the list in userData/shelf.json (not under modules/: module-set must not reach it).
// The renderer names items by id only; every path is shelfFile(shelfDir, name) for a name that is really in the folder.
const shelfDir = path.join(app.getPath('userData'), 'shelf');
const shelfIndex = path.join(app.getPath('userData'), 'shelf.json');
let shelf = null; // [{ id, name } | { id, text }], oldest first; read on first use
let shelfQueue = Promise.resolve();
const shelfDo = (fn) => (shelfQueue = shelfQueue.catch(() => {}).then(fn)); // one change at a time: free names and the 2 GB stay right
// The folder is the truth for files: gone ones drop out, unknown ones (list lost, Nikki stopped mid-drop) are adopted.
// An unreadable list throws here, so nothing ever writes over it (H2).
function shelfItems() {
  shelf ??= (() => {
    const saved = readJson(shelfIndex, (moved) => warn(`Die Liste der Ablage war beschädigt und liegt jetzt unter\n${moved}\nDie Dateien selbst sind noch da.`));
    return (Array.isArray(saved?.items) ? saved.items : []).filter((i) => typeof i?.id === 'string' && (typeof i.text === 'string' || typeof i.name === 'string'));
  })();
  fs.mkdirSync(shelfDir, { recursive: true });
  const files = fs.readdirSync(shelfDir, { withFileTypes: true }).filter((d) => d.isFile()).map((d) => d.name);
  shelf = shelf.filter((i) => typeof i.text === 'string' || files.includes(i.name));
  for (const name of files) if (!shelf.some((i) => i.name === name)) shelf.push({ id: crypto.randomUUID(), name });
  return shelf;
}
let shelfSaveFailed = false;
function shelfSave() {
  try {
    writeJsonAtomic(shelfIndex, { items: shelf });
    shelfSaveFailed = false;
  } catch (e) {
    console.error(shelfIndex, e);
    if (!shelfSaveFailed) warn(`Nikki kann die Liste der Ablage nicht speichern: ${e.code ?? e.message}`);
    shelfSaveFailed = true;
  }
}
const thumbs = new Map(); // file -> Promise<data URL | ''>; copies never change, so one look per file
const thumb = (file) => {
  if (!thumbs.has(file)) thumbs.set(file, nativeImage.createThumbnailFromPath(file, { width: 96, height: 96 }).then((img) => (img.isEmpty() ? '' : img.toDataURL()), () => ''));
  return thumbs.get(file);
};
const sizeOf = (file) => {
  try {
    return fs.statSync(file).size;
  } catch {
    return 0;
  }
};
// what the renderer sees: [{ id, name, size (text), path?, thumb?, text? }]
const shelfList = () =>
  Promise.all(
    shelfItems().map(async (i) => {
      if (typeof i.text === 'string') return { id: i.id, text: i.text, name: i.text.replace(/\s+/g, ' ').trim().slice(0, 60), size: 'Text' };
      const file = shelfFile(shelfDir, i.name);
      return { id: i.id, name: i.name, path: file, size: formatSize(sizeOf(file)), thumb: await thumb(file) };
    }),
  );
ipcMain.handle('shelf-list', () => shelfDo(shelfList));
ipcMain.handle('shelf-add', (_e, paths) =>
  shelfDo(async () => {
    const items = shelfItems();
    const errors = [];
    const files = [];
    for (const src of (Array.isArray(paths) ? paths : []).slice(0, 200)) {
      if (typeof src !== 'string' || !path.isAbsolute(src)) continue;
      // dragged out of the shelf and dropped back onto the island: it is here already
      if (path.dirname(path.resolve(src)).toLowerCase() === shelfDir.toLowerCase()) continue;
      const name = path.basename(src);
      try {
        const st = await fs.promises.stat(src);
        if (st.isFile()) files.push({ src, name, size: st.size });
        else errors.push(`„${name}“ ist ein Ordner. Die Ablage nimmt nur Dateien.`);
      } catch (e) {
        errors.push(`„${name}“ kann Nikki nicht lesen (${e.code ?? e.message}).`);
      }
    }
    const names = items.filter((i) => i.name).map((i) => i.name);
    const used = names.reduce((sum, n) => sum + sizeOf(shelfFile(shelfDir, n)), 0);
    const plan = planAdd(files, used, names);
    for (const f of plan.ok) {
      const dest = shelfFile(shelfDir, f.name);
      try {
        await fs.promises.copyFile(f.src, dest, fs.constants.COPYFILE_EXCL);
        items.push({ id: crypto.randomUUID(), name: f.name });
      } catch (e) {
        if (e.code !== 'EEXIST') fs.rmSync(dest, { force: true }); // no half copy left behind (disk full)
        errors.push(`„${f.name}“ kam nicht in die Ablage (${e.code ?? e.message}).`);
      }
    }
    shelfSave();
    return { items: await shelfList(), errors: [...errors, ...plan.errors] };
  }),
);
ipcMain.handle('shelf-add-text', (_e, text) =>
  shelfDo(async () => {
    const t = String(text ?? '').trim().slice(0, 20000);
    if (t) {
      shelfItems().push({ id: crypto.randomUUID(), text: t });
      shelfSave();
    }
    return { items: await shelfList(), errors: [] };
  }),
);
ipcMain.handle('shelf-clear', () =>
  shelfDo(async () => {
    const errors = [];
    const kept = [];
    for (const i of shelfItems()) {
      if (typeof i.text === 'string') continue;
      try {
        await fs.promises.rm(shelfFile(shelfDir, i.name), { force: true });
      } catch (e) {
        kept.push(i);
        errors.push(`„${i.name}“ ist noch offen und bleibt liegen (${e.code ?? e.message}).`);
      }
    }
    shelf = kept;
    thumbs.clear();
    shelfSave();
    return { items: await shelfList(), errors };
  }),
);
// double click: the copy in the shelf opens in its app; '' or why not
ipcMain.handle('shelf-open', (_e, id) => {
  const i = shelfItems().find((x) => x.id === id && typeof x.name === 'string');
  return i ? shell.openPath(shelfFile(shelfDir, i.name)) : 'nicht gefunden';
});
// Dragging out hands Windows the copies (copy, not move): the shelf keeps them, a cancelled drag loses nothing.
let dragIcon;
ipcMain.on('shelf-drag', (e, ids) => {
  const files = shelfItems()
    .filter((i) => typeof i.name === 'string' && Array.isArray(ids) && ids.includes(i.id))
    .map((i) => shelfFile(shelfDir, i.name));
  dragIcon ??= nativeImage.createFromPath(path.join(dir, 'assets', 'icon.png')).resize({ width: 32, height: 32 });
  if (files.length) e.sender.startDrag({ file: files[0], files, icon: dragIcon });
});

// --- clipboard history (module "clipboard", opt-in): the system clipboard is read once a second, only while the module is on.
// Text only, in memory; on disk (userData/clipboard.json) only with "Verlauf merken". See lib/clipboard.js.
const clipFile = path.join(app.getPath('userData'), 'clipboard.json');
let clips = []; // [{ text, at }], newest first
let clipSeen = null; // the clipboard text at the last look
let clipTimer = null;
let clipWritable = true; // a history file we could not read is never written over (H2)
const clipOn = () => !quitting && store.modules.some((m) => m.id === 'clipboard' && m.on);
const clipState = () => ({ items: clips, keep: !!store.clipKeep });
function syncClipboard() {
  if (clipOn() === !!clipTimer) return;
  if (clipTimer) {
    clearInterval(clipTimer);
    clipTimer = null;
    clips = []; // switched off: what was only in memory is forgotten
    clipSeen = null;
    return;
  }
  if (store.clipKeep) clips = loadClips();
  pollClipboard();
  clipTimer = setInterval(pollClipboard, 1000);
}
// Electron 45's clipboard is async (W3C style); one look at a time
let clipLooking = false;
const MONITOR_OFF = ['ExcludeClipboardContentFromMonitorProcessing', 'Clipboard Viewer Ignore'].map((f) => `electron application/osclipboard;format="${f}"`);
async function pollClipboard() {
  if (clipLooking) return;
  clipLooking = true;
  try {
    const text = await clipboard.readText();
    if (text === clipSeen) return;
    clipSeen = text;
    // password managers mark what they copy as not for clipboard monitors and histories: it stays out
    for (const f of MONITOR_OFF) if (await clipboard.has(f)) return;
    if (clipTimer) setClips(addClip(clips, text, Date.now())); // still on after the wait
  } catch {
    // another app holds the clipboard open: next second
  } finally {
    clipLooking = false;
  }
}
function setClips(next) {
  if (next === clips) return;
  clips = next;
  if (store.clipKeep) saveClips();
  send('clipboard', clipState());
}
function loadClips() {
  try {
    return restoreClips(readJson(clipFile, (moved) => warn(`Der Verlauf der Zwischenablage war beschädigt und liegt jetzt unter
${moved}`))?.items);
  } catch (e) {
    clipWritable = false;
    warn(`Nikki kann ${clipFile} nicht lesen (${e.code ?? e.message}). Bis zum Neustart merkt sich Nikki den Verlauf nicht.`);
    return [];
  }
}
let clipSaveFailed = false;
function saveClips() {
  if (!clipWritable) return;
  try {
    writeJsonAtomic(clipFile, { items: clips });
    clipSaveFailed = false;
  } catch (e) {
    console.error(clipFile, e);
    if (!clipSaveFailed) warn(`Nikki kann den Verlauf der Zwischenablage nicht speichern: ${e.code ?? e.message}`);
    clipSaveFailed = true;
  }
}
ipcMain.handle('clip-get', clipState);
// copy an entry again: it moves to the top right away, the next look sees it as known
ipcMain.handle('clip-copy', async (_e, text) => {
  if (typeof text !== 'string' || !text) return clipState();
  await clipboard.writeText(text);
  clipSeen = text;
  setClips(addClip(clips, text, Date.now()));
  return clipState();
});
ipcMain.handle('clip-remove', (_e, text) => (setClips(removeClip(clips, text)), clipState()));
ipcMain.handle('clip-clear', () => (setClips(clips.length ? [] : clips), clipState()));
ipcMain.handle('clip-keep', (_e, on) => {
  store.clipKeep = !!on;
  save();
  if (store.clipKeep) saveClips();
  else
    try {
      fs.rmSync(clipFile, { force: true }); // "Verlauf merken" off: nothing stays on disk
    } catch (e) {
      warn(`Nikki kann ${clipFile} nicht löschen: ${e.code ?? e.message}`);
    }
  send('clipboard', clipState());
  return clipState();
});

// --- weather for the Home tile (Open-Meteo, lib/weather.js): fetched here, never in the renderer (CSP); every 30 min and when the city changes.
// The last good answer stays in the store; offline it is shown with its time and an error, without one a friendly hint.
// store.weather: { query, place?: { name, lat, lon }, temp?, text?, icon?, max?, min?, hours?, at?, error?: 'offline' | 'notfound' } | null
const getJson = async (url) => {
  const r = await net.fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
};
async function fetchWeather() {
  const city = store.weatherCity;
  const last = store.weather?.query === city ? store.weather : null;
  let next;
  if (!city) next = null;
  else
    try {
      const place = last?.place ?? parsePlace(await getJson(geocodeUrl(city)));
      next = place ? { query: city, place, ...parseForecast(await getJson(forecastUrl(place))), at: Date.now() } : { query: city, error: 'notfound' };
    } catch (e) {
      console.error('weather:', e.message);
      next = { ...(last ?? { query: city }), error: 'offline' };
    }
  if (store.weatherCity !== city) return; // the city changed meanwhile: its own fetch answers
  store.weather = next;
  save();
  send('weather', next);
}
ipcMain.handle('weather-get', () => (store.weather?.query === store.weatherCity ? store.weather : null));

ipcMain.on('toast', (_e, text) => notify(String(text ?? '').slice(0, 200), true));
ipcMain.on('open-external', (_e, url) => /^https?:\/\//i.test(url) && shell.openExternal(url));
ipcMain.on('stop', () => agent.stop());
ipcMain.on('permission-answer', (_e, { id, ...answer }) => {
  pending.get(id)?.(answer);
});

// --- terminal sessions: Claude Code hooks POST their events to this local server
let terminal = new Map(); // session_id -> { id, cwd, state, text, tool?, at }, see lib/terminal.js
const hookCfgFile = path.join(app.getPath('userData'), 'hook.json');
const hookToken = crypto.randomBytes(16).toString('hex');
function setTerminal(sessions, changed) {
  if (sessions === terminal) return;
  terminal = sessions;
  send('terminal', { sessions: [...terminal.values()], changed });
}
function onHookEvent(e) {
  relay.onEvent(e);
  const { sessions, changed } = onHook(terminal, e, Date.now());
  setTerminal(sessions, changed);
  const where = path.basename(String(e.cwd ?? ''));
  if (changed === 'needsYou') notify(`${where}: ${terminal.get(String(e.session_id))?.text}`);
  if (changed === 'done') notify(`Session in ${where} ist fertig.`);
}
// a terminal closed without SessionEnd, or an old "fertig", must not need a new event to go away (M4)
setInterval(() => setTerminal(sweep(terminal, Date.now())), 60 * 1000).unref();
// --- answering terminal sessions from the island (hook.cjs --wait / --stop), see lib/relay.js
const relay = createRelay();
// A terminal PermissionRequest shows the same card as our own sessions; the hook waits on the open HTTP request.
function askTerminal(e, res) {
  onHookEvent(e); // status + toast as for any observed event
  const id = nextId++;
  const { id: rid } = relay.wait(e, (reply) => {
    pending.delete(id);
    if (reply) res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(reply));
    else {
      if (!res.writableEnded) res.writeHead(204).end();
      send('permission-cancel', id); // answered in the terminal, timed out, or the hook went away
    }
  });
  // the hook gave up (its 110 s) or Claude Code killed it: drop the card, the terminal decides
  res.on('close', () => relay.answer(rid, null));
  pending.set(id, ({ answer, picks, message }) =>
    relay.answer(rid, answer === 'deny' ? { answer: 'deny', message } : { answer: answer === 'always' ? 'always' : 'allow', picks }),
  );
  send('permission-request', {
    id,
    origin: 'terminal',
    sessionId: e.session_id,
    cwd: e.cwd,
    toolName: e.tool_name,
    input: e.tool_input ?? {},
    canAlways: !!e.can_always,
  });
  userHidden = false;
  applyVisibility();
}
// Messages for a terminal session that still works: handed to Claude by the Stop hook when its turn ends.
const queued = new Map(); // session_id → text
function takeQueued(sid) {
  const msg = queued.get(String(sid));
  queued.delete(String(sid));
  if (msg) send('queued', { sessionId: String(sid), text: null });
  return msg || null;
}
// jump to a terminal session: the helper walks up from its Claude process to the window that holds it
const NO_TERMINAL = 'Das Terminal-Fenster habe ich nicht gefunden.';
ipcMain.on('terminal-focus', (_e, id, hint) => {
  const pid = sessionPid(path.join(os.homedir(), '.claude', 'sessions'), String(id));
  // the project's folder name picks the right window when one program (VS Code) holds several
  const title = String(hint ?? '').replace(/[\r\n]/g, ' ').slice(0, 80);
  if (pid && helper) helper.stdin.write(`focus ${pid} ${title}\n`);
  else notify(NO_TERMINAL, true);
});

ipcMain.handle('queue-message', (_e, { sessionId, text }) => {
  const t = String(text ?? '').trim();
  if (!sessionId || !t || !store.hooks || store.relay === false) return false;
  queued.set(String(sessionId), queued.has(String(sessionId)) ? `${queued.get(String(sessionId))}

${t}` : t);
  send('queued', { sessionId: String(sessionId), text: queued.get(String(sessionId)) });
  return true;
});

// --- plan limits for the Claude tile; every five minutes, and when the island opens on an older reading
const USAGE_MS = 5 * 60 * 1000;
let usageAt = 0;
let usageBusy = false;
const usageWarned = new Set();
async function refreshUsage() {
  // test runs never reach the real account; the island asks on every opening and card, once a minute is enough
  if (usageBusy || quitting || process.env.NIKKI_NO_HELPER || Date.now() - usageAt < 60 * 1000) return;
  usageBusy = true;
  usageAt = Date.now();
  try {
    const claudePath = await findClaude();
    const usage = claudePath ? toUsage(await readLimits(claudePath)) : null;
    if (usage) send('usage', usage); // a failed reading keeps the last one
    for (const text of limitWarnings(usage, usageWarned)) notify(text, true);
  } finally {
    usageBusy = false;
  }
}
ipcMain.on('usage-refresh', refreshUsage);
setInterval(refreshUsage, USAGE_MS).unref();

// --- the sounds folder (lib/sounds.js): the island plays what lies there; a changed file counts at once
ipcMain.handle('sound-files', () => soundFiles(soundsDir()));
ipcMain.on('sounds-open', () => {
  try {
    const readme = path.join(soundsDir(), 'LIESMICH.txt');
    if (!fs.existsSync(readme)) fs.writeFileSync(readme, soundsReadme());
  } catch (e) {
    console.error('sounds:', e);
  }
  shell.openPath(soundsDir());
});
function watchSounds() {
  try {
    fs.mkdirSync(soundsDir(), { recursive: true });
    let timer;
    fs.watch(soundsDir(), () => {
      clearTimeout(timer);
      timer = setTimeout(() => send('sounds-changed'), 300); // a copy fires many times and must be done first
    }).on('error', () => {});
  } catch (e) {
    console.error('sounds:', e);
  }
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
      let e = null;
      try {
        e = JSON.parse(body);
      } catch {}
      if (req.url === '/hook/wait' && e && !quitting && store.relay !== false) return askTerminal(e, res);
      if (req.url === '/hook/stop' && e && !quitting) {
        const msg = takeQueued(e.session_id);
        res.writeHead(msg ? 200 : 204, { 'content-type': 'application/json' }).end(msg ? JSON.stringify({ message: msg }) : undefined);
      } else res.writeHead(204).end();
      if (quitting || !e) return;
      try {
        onHookEvent(e);
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
      tr(e instanceof SyntaxError ? `${file} ist kein gültiges JSON. Ich ändere daran nichts.` : `Nikki kann ${file} nicht ändern (${e.code ?? e.message}).`),
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
    return;
  }
  const node = await findNode();
  if (node) writeHooks((s) => withHooks(s, hookCommand(node), { relay: store.relay !== false }));
}

async function setHooks(on) {
  const node = on ? await findNode() : null;
  if (on && !node) {
    dialog.showErrorBox('Nikki', tr('Für Terminal-Sessions braucht es Node.js (der Befehl „node“ wurde nicht gefunden).'));
    on = false;
  } else if (!writeHooks((s) => (on ? withHooks(s, hookCommand(node), { relay: store.relay !== false }) : withoutHooks(s)))) on = store.hooks;
  store.hooks = on;
  save();
  if (!on) {
    relay.cancelAll();
    queued.clear();
    terminal = new Map();
    send('terminal', { sessions: [] });
  }
}

// `Nikki.exe --remove-hooks` (run by the uninstaller, installer.nsh): take our hooks out of the user's settings and exit,
// so no Claude session keeps calling a hook.cjs that is gone (M6). No window, no dialog, no single-instance handoff.
const removeHooksRequest = process.argv.includes('--remove-hooks');
if (removeHooksRequest) {
  for (const [file, mutate] of [
    [settingsFile, withoutHooks],
    [cursorHooksFile, withoutCursorHooks],
  ]) {
    try {
      editJson(file, mutate);
    } catch (e) {
      console.error(file, e);
    }
  }
}

// A second launch (e.g. double-clicking the .exe again) just opens the island of the running one.
// `Nikki.exe --quit` (used by Updater.exe) closes the running one cleanly instead.
const quitRequest = process.argv.includes('--quit') || removeHooksRequest;
const firstInstance = !removeHooksRequest && app.requestSingleInstanceLock();
if (!firstInstance || quitRequest) app.quit();
app.on('second-instance', (_e, argv) => (argv.includes('--quit') ? app.quit() : alive() && showNow()));

let tray; // module-level so it isn't garbage-collected
let hotkey = null;
const hotkeyTip = () => tray?.setToolTip(hotkey ? tr(`Nikki (${hotkey.replace('Control', 'Strg').replace('Space', 'Leertaste')})`) : 'Nikki');
// register() is false when another app holds the combo, and throws for one Electron cannot parse
function register(acc, fn = () => showNow()) {
  try {
    return globalShortcut.register(acc, fn);
  } catch {
    return null;
  }
}
// The new combo is taken first; only then the old one is let go, so a conflict never leaves Nikki without a hotkey.
function setHotkey(acc) {
  if (acc === hotkey) return null;
  if (acc === store.closeKey) return 'taken';
  const ok = register(acc);
  if (!ok) return ok === null ? 'invalid' : 'taken';
  if (hotkey) globalShortcut.unregister(hotkey);
  hotkey = store.hotkey = acc;
  hotkeyTip();
  return null;
}
// The close key is held only while the island is open, so even a plain Esc stays with the other apps the rest of the time.
let islandOpen = false;
let closeKeyHeld = false;
function syncCloseKey() {
  const want = !!store.closeKey && islandOpen && alive() && win.isVisible();
  if (want && !closeKeyHeld) closeKeyHeld = !!register(store.closeKey, () => send('close-key'));
  if (!want && closeKeyHeld) {
    globalShortcut.unregister(store.closeKey);
    closeKeyHeld = false;
  }
}
ipcMain.on('island-open', (_e, on) => {
  islandOpen = on;
  syncCloseKey();
  reloadIslandWhenFree();
});
// '' clears it. A trial registration, so a taken combo is said now and not silently the next time the island opens.
function setCloseKey(acc) {
  if (acc === (store.closeKey ?? '')) return null;
  if (acc === hotkey) return 'taken';
  if (closeKeyHeld) {
    globalShortcut.unregister(store.closeKey);
    closeKeyHeld = false;
  }
  if (acc) {
    const ok = register(acc, () => {});
    if (!ok) {
      syncCloseKey();
      return ok === null ? 'invalid' : 'taken';
    }
    globalShortcut.unregister(acc);
  }
  store.closeKey = acc || null;
  syncCloseKey();
  return null;
}
function createTray() {
  tray?.destroy();
  tray = new Tray(nativeImage.createFromPath(path.join(dir, 'assets', 'tray.png')).resize({ width: 16, height: 16 }));
  tray.on('click', () => showNow());
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: tr('Ein-/Ausblenden'),
        click: () => {
          if (!alive()) return;
          userHidden = win.isVisible();
          applyVisibility();
          // hidden by a fullscreen app, not by the user: an explicit click shows it anyway, like the hotkey (N6)
          if (!userHidden && !win.isVisible()) showNow();
        },
      },
      { label: tr('Einstellungen'), click: () => openSettings() },
      { type: 'separator' },
      { label: tr('Beenden'), click: () => app.quit() },
    ]),
  );
  hotkeyTip();
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
  watchSounds();
  syncHelper();
  syncClipboard();
  syncDiscord();
  if (store.voice) voiceInstall();
  if (store.weatherCity) fetchWeather();
  setInterval(() => store.weatherCity && fetchWeather(), 30 * 60 * 1000).unref();
  applyAwake(); // switched on by hand last time
  // a watcher that is slow to start (Add-Type) must not keep the island away for long
  setTimeout(() => fullscreen === null && setFullscreen(false), 3000);
  findClaude();
  setTimeout(refreshUsage, 8000); // the island's page is up by then
  // a display that went away or changed: put the island back on the display it overlaps most (or the nearest)
  const replace = () => alive() && place(screen.getDisplayMatching(win.getBounds()));
  screen.on('display-removed', replace);
  screen.on('display-metrics-changed', replace);
  // explicit user action: shows the island even over a fullscreen app
  // the user's own combo first; Ctrl+Alt+Space is often taken (Claude Desktop, Developer Island): fall back to Ctrl+Alt+K
  hotkey = [store.hotkey, 'Control+Alt+Space', 'Control+Alt+K'].find((k) => k && register(k)) ?? null;
  hotkeyTip();
  if (storeNotice) dialog.showMessageBox({ type: 'warning', title: 'Nikki', message: tr(storeNotice) }).catch(() => {});
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
  agent.abort(); // no claude.exe left running on its own (M5)
  stopHelper();
  discord?.stop();
  clearInterval(clipTimer);
  relay.cancelAll(); // waiting terminal hooks fall back to their own dialog
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
