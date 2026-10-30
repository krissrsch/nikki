// Starts Nikki for the e2e tests: Playwright's Electron driver, a fresh temp userData every time, never the user's data.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { _electron as electron } from 'playwright';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const electronPath = createRequire(import.meta.url)('electron'); // the package exports the path of its binary
export const tmpDir = (name) => fs.mkdtempSync(path.join(os.tmpdir(), `nikki-e2e-${name}-`));
export const rm = (dir) => dir && fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });

// Polls fn until it returns something truthy (files on disk, main-process state).
export async function until(fn, what, ms = 10000) {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) throw new Error(`Zeit abgelaufen: ${what}`);
    await new Promise((r) => setTimeout(r, 100));
  }
}

// state: initial state.json (fixture). settings: initial ~/.claude/settings.json in the temp home.
// realHome: keep the user's home, only for runs that need the Claude login.
// Without it HOME/USERPROFILE point to a temp folder, so nothing can reach the real ~/.claude/settings.json.
export async function launch({ state, settings, realHome = false } = {}) {
  const userData = tmpDir('data');
  const home = realHome ? null : tmpDir('home');
  // no start show, no jump between tabs in the tests: the page switches at once, as the assertions expect (cat.e2e.js turns it on)
  fs.writeFileSync(path.join(userData, 'state.json'), JSON.stringify({ catJump: false, intro: false, ...state }));
  // started like the user would: no nested Claude Code session, no API key, no node mode
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(CLAUDECODE|CLAUDE_CODE_|ANTHROPIC_|ELECTRON_RUN_AS_NODE)/.test(k)));
  env.NIKKI_USER_DATA = userData;
  env.NIKKI_NO_HELPER = '1'; // no NikkiHelper.exe: the user's real media session and volume stay out of every run
  if (home) {
    env.HOME = env.USERPROFILE = home;
    // Claude counts as installed on every machine; the offline tests replace it before anything would run it
    fs.mkdirSync(path.join(home, '.local', 'bin'), { recursive: true });
    fs.writeFileSync(path.join(home, '.local', 'bin', 'claude.exe'), '');
    if (settings) {
      fs.mkdirSync(path.join(home, '.claude'));
      fs.writeFileSync(path.join(home, '.claude', 'settings.json'), JSON.stringify(settings));
    }
  }
  // --user-data-dir too: an app without NIKKI_USER_DATA support still stays off the real data
  // cwd in temp: with a temp USERPROFILE, PowerShell (fullscreen watcher) writes its module cache relative to it
  const app = await electron.launch({ args: [`--user-data-dir=${userData}`, root], cwd: userData, executablePath: electronPath, env });
  const errors = [];
  app.on('console', (m) => m.type() === 'error' && errors.push(`main: ${m.text()}`));
  const page = await app.firstWindow();
  page.on('console', (m) => m.type() === 'error' && errors.push(`renderer: ${m.text()}`));
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

  const nikki = {
    app,
    page,
    userData,
    home,
    errors,
    state: () => JSON.parse(fs.readFileSync(path.join(userData, 'state.json'), 'utf8')),
    // a status from the Claude backend, as main would send it
    status: (s) => app.evaluate(({ BrowserWindow }, s) => BrowserWindow.getAllWindows().find((w) => w.isAlwaysOnTop()).webContents.send('status', s), s),
    permission: (r) => app.evaluate(({ BrowserWindow }, r) => BrowserWindow.getAllWindows().find((w) => w.isAlwaysOnTop()).webContents.send('permission-request', r), r),
    // opens the settings window with the gear, on the given sidebar page (the island closes for it)
    settings: async (pageId) => {
      const [s] = await Promise.all([app.waitForEvent('window'), page.click('#openSettings')]);
      s.on('console', (m) => m.type() === 'error' && errors.push(`settings: ${m.text()}`));
      s.on('pageerror', (e) => errors.push(`settings: ${e.message}`));
      await s.waitForSelector('.sideBtn');
      if (pageId) await s.click(`.sideBtn[data-page="${pageId}"]`);
      return s;
    },
    // offline stand-in for Claude: records start/stop instead of running the CLI
    fakeClaude: () =>
      app.evaluate(({ ipcMain }) => {
        globalThis.e2e = { starts: [], stops: 0 };
        ipcMain.removeHandler('start');
        ipcMain.handle('start', (_e, args) => (globalThis.e2e.starts.push(args), true));
        ipcMain.removeAllListeners('stop');
        ipcMain.on('stop', () => globalThis.e2e.stops++);
      }),
    calls: () => app.evaluate(() => globalThis.e2e),
    // the folder dialog answers with this path instead of opening
    pickFolderReturns: (dir) =>
      app.evaluate(({ dialog }, dir) => {
        dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [dir] });
      }, dir),
    openChat: () => page.click('#tabs .tab[data-view="chat"]'),
    send: async (text) => {
      await page.fill('#prompt', text);
      await page.press('#prompt', 'Enter');
    },
    busy: () => page.evaluate(() => document.getElementById('go').getAttribute('aria-label') === 'Stoppen'),
    close: async () => {
      await app.close().catch(() => {});
      rm(userData);
      rm(home);
    },
  };
  // booted and opened; the island stays hidden (and the boot waits) while a fullscreen app is in front
  await page
    .waitForFunction(() => document.getElementById('island')?.matches('.open:not(.boot)'), null, { timeout: 20000 })
    .catch(async (e) => {
      await nikki.close();
      throw new Error(`Nikki kam nicht hoch (läuft eine Vollbild-App?): ${e.message}`);
    });
  return nikki;
}
