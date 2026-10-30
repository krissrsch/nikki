// Phase 3a offline: music without the helper (main's media events are sent by the test), the shelf through main's IPC
// and a drop, keep-awake. Same isolation as app.e2e.js: temp userData and HOME, no NikkiHelper.exe (NIKKI_NO_HELPER).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, test } from 'node:test';
import { launch, rm, tmpDir, until } from './nikki.js';

let nikki;
const dirs = [];
afterEach(async () => {
  await nikki?.close();
  nikki = null;
  dirs.splice(0).forEach(rm);
});
// an event from main, as main would send it
const fromMain = (channel, data) => nikki.app.evaluate(({ BrowserWindow }, [c, d]) => BrowserWindow.getAllWindows()[0].webContents.send(c, d), [channel, data]);
// a text dragged from another app and dropped on the island
async function dropText(text) {
  const dataTransfer = await nikki.page.evaluateHandle((t) => {
    const d = new DataTransfer();
    d.setData('text/plain', t);
    return d;
  }, text);
  await nikki.page.dispatchEvent('#island', 'drop', { dataTransfer });
}

describe('Module aus Phase 3', () => {
  test('Musik: ohne Helfer ein sauberer Leerzustand; Wiedergabe zeigt Seite, Kachel und tanzende Notch', async () => {
    nikki = await launch();
    const { page, app } = nikki;
    const tile = page.locator('#homeTiles .modTile', { has: page.locator('button.tileHead', { hasText: 'Musik' }) });
    assert.match(await tile.textContent(), /Gerade still/);
    await page.click('#tabs .tab[data-view="music"]');
    await page.waitForSelector('.mod-music .musicEmpty');
    assert.match(await page.textContent('.mod-music'), /Gerade läuft nichts/);
    assert.equal(await page.locator('.mod-music .musicVolume, .mod-music .musicCtrl').count(), 0, 'keine Knöpfe ohne Helfer');

    await app.evaluate(({ ipcMain }) => {
      globalThis.cmds = [];
      ipcMain.on('media-cmd', (_e, cmd, value) => globalThis.cmds.push(value === undefined ? cmd : `${cmd} ${value}`));
    });
    await fromMain('volume', { level: 40, muted: false });
    await fromMain('media', { app: 'Spotify.exe', title: 'Testlied', artist: 'Nikki', status: 'playing', position: 10, duration: 200, updatedAt: Date.now(), cover: '' });
    await page.waitForSelector('.mod-music .musicTitle:has-text("Testlied")');
    assert.equal(await page.textContent('.mod-music .musicSub'), 'Nikki · Spotify');
    assert.equal(await page.textContent('.mod-music .musicBar > span:last-child'), '3:20');
    await page.click('.mod-music .mBtn.play');
    await page.click('.mod-music [aria-label="Weiter"]');
    await page.locator('.mod-music .musicVol').fill('55');
    await page.click('.mod-music .mBtn.mute');
    await until(async () => (await app.evaluate(() => globalThis.cmds)).length === 4, 'Befehle an main');
    assert.deepEqual(await app.evaluate(() => globalThis.cmds), ['toggle', 'next', 'volume 55', 'mute']);
    assert.match(await tile.textContent(), /Testlied/);
    // players send a fresh position snapshot every few seconds: the page keeps the keyboard focus
    await page.focus('.mod-music [aria-label="Weiter"]');
    await fromMain('media', { app: 'Spotify.exe', title: 'Testlied', artist: 'Nikki', status: 'playing', position: 14, duration: 200, updatedAt: Date.now(), cover: '' });
    await page.waitForTimeout(200);
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'Weiter');

    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.getElementById('island').dataset.mood === 'music');
    assert.equal(await page.textContent('#glanceL'), 'Testlied');
    assert.equal(await page.locator('#glanceR .g-bar').count(), 4, 'Visualizer');
    // a volume change from outside shows for 2 s (ours a moment ago does not count)
    await page.waitForTimeout(1600);
    await fromMain('volume', { level: 70, muted: false });
    await page.waitForFunction(() => document.getElementById('glanceL').textContent === '70 %');
    await page.waitForFunction(() => document.getElementById('island').dataset.mood === 'music', null, { timeout: 4000 });
    assert.deepEqual(nikki.errors, []);
  });

  test('Ablage: Text und Dateien landen in userData/shelf, Auswahl geht als Pfad an den Chat, „Alles leeren“ leert', async () => {
    const src = tmpDir('quelle');
    dirs.push(src);
    fs.writeFileSync(path.join(src, 'notiz.txt'), 'hallo');
    nikki = await launch();
    const { page } = nikki;
    const shelf = path.join(nikki.userData, 'shelf');
    await nikki.fakeClaude();

    // dropped on Home (not the chat): the shelf takes it and opens
    await dropText('npm run dist');
    await page.waitForSelector('.shelfItem:has-text("npm run dist")');
    assert.equal(await page.getAttribute('#tabs .tab[data-view="shelf"]', 'aria-pressed'), 'true');
    // the same file twice: a copy each, the second under a free name
    for (let i = 0; i < 2; i++) await page.evaluate((p) => window.companion.shelfAdd([p]), path.join(src, 'notiz.txt'));
    assert.deepEqual(fs.readdirSync(shelf).sort(), ['notiz (2).txt', 'notiz.txt']);
    assert.equal(fs.readFileSync(path.join(shelf, 'notiz.txt'), 'utf8'), 'hallo');
    assert.equal(fs.readFileSync(path.join(src, 'notiz.txt'), 'utf8'), 'hallo', 'das Original bleibt');
    // added behind the page's back: opening it again reads the folder, the Home tile follows
    await page.click('#tabs .tab[data-view="home"]');
    await page.click('#tabs .tab[data-view="shelf"]');
    await page.waitForSelector('.shelfItem:has-text("notiz (2).txt")');
    assert.match(await page.textContent('#homeTiles'), /3 Einträge/);

    await page.click('.shelfItem:has-text("notiz.txt")');
    assert.equal(await page.getAttribute('.shelfItem:has-text("notiz.txt")', 'aria-pressed'), 'true');
    assert.match(await page.textContent('.shelfInfo'), /3 Einträge · 1 ausgewählt/);
    await page.click('.shelfBar button:has-text("An Chat anhängen")');
    assert.equal(await page.inputValue('#prompt'), `"${path.join(shelf, 'notiz.txt')}"`);
    assert.equal(await page.getAttribute('#tabs .tab[data-view="chat"]', 'aria-pressed'), 'true');
    assert.deepEqual((await nikki.calls()).starts, [], 'nicht abgeschickt');
    // in the chat tab a drop keeps its old way: nothing new on the shelf
    await dropText('bleibt draußen');
    await page.click('#tabs .tab[data-view="shelf"]');
    assert.equal(await page.locator('.shelfItem').count(), 3);

    await page.click('.shelfBar button:has-text("Alles leeren")');
    assert.match(await page.textContent('.shelfInfo'), /nicht rückgängig/);
    await page.click('.shelfBar button:text-is("Leeren")');
    await page.waitForSelector('.shelfEmpty');
    assert.deepEqual(fs.readdirSync(shelf), []);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(nikki.userData, 'shelf.json'), 'utf8')).items, []);
    assert.deepEqual(nikki.errors, []);
  });

  test('Wachhalten: der Schalter in den Settings hält den PC wach und gibt ihn wieder frei', async () => {
    nikki = await launch();
    const { page, app } = nikki;
    // recorded instead of run: the test must not keep the real PC awake
    await app.evaluate(({ powerSaveBlocker }) => {
      globalThis.awake = [];
      powerSaveBlocker.start = (type) => (globalThis.awake.push(type), 7);
      powerSaveBlocker.stop = (id) => globalThis.awake.push(`stop ${id}`);
    });
    await page.click('#tabs .tab[data-view="settings"]');
    await page.click('#setAwake');
    await until(async () => (await app.evaluate(() => globalThis.awake)).length === 1, 'Wachhalten an');
    assert.equal(nikki.state().keepAwake, true);
    await page.click('#setAwake');
    await until(async () => (await app.evaluate(() => globalThis.awake)).length === 2, 'Wachhalten aus');
    assert.deepEqual(await app.evaluate(() => globalThis.awake), ['prevent-display-sleep', 'stop 7']);
  });
});
