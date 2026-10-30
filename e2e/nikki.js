// Starts Nikki for the e2e tests: Playwright's Electron driver, a fresh temp userData every time, never the user's data.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { _electron as electron } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
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

// state: initial state.json (fixture). realHome: keep the user's home, only for runs that need the Claude login.
// Without it HOME/USERPROFILE point to a temp folder, so nothing can reach ~/.claude/settings.json.
export async function launch({ state, realHome = false } = {}) {
  const userData = tmpDir('data');
  const home = realHome ? null : tmpDir('home');
  if (state) fs.writeFileSync(path.join(userData, 'state.json'), JSON.stringify(state));
  // started like the user would: no nested Claude Code session, no API key, no node mode
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(CLAUDECODE|CLAUDE_CODE_|ANTHROPIC_|ELECTRON_RUN_AS_NODE)/.test(k)));
  env.NIKKI_USER_DATA = userData;
  if (home) {
    env.HOME = env.USERPROFILE = home;
    // Claude counts as installed on every machine; the offline tests replace it before anything would run it
    fs.mkdirSync(path.join(home, '.local', 'bin'), { recursive: true });
    fs.writeFileSync(path.join(home, '.local', 'bin', 'claude.exe'), '');
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
    status: (s) => app.evaluate(({ BrowserWindow }, s) => BrowserWindow.getAllWindows()[0].webContents.send('status', s), s),
    permission: (r) => app.evaluate(({ BrowserWindow }, r) => BrowserWindow.getAllWindows()[0].webContents.send('permission-request', r), r),
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
