// Phase 3a offline: music without the helper (main's media events are sent by the test), the shelf through main's IPC
// and a drop, keep-awake. Same isolation as app.e2e.js: temp userData and HOME, no NikkiHelper.exe (NIKKI_NO_HELPER).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, test } from 'node:test';
import { launch, rm, root, tmpDir, until } from './nikki.js';

let nikki;
const dirs = [];
afterEach(async () => {
  await nikki?.close();
  nikki = null;
  dirs.splice(0).forEach(rm);
});
// an event from main, as main would send it
const fromMain = (channel, data) => nikki.app.evaluate(({ BrowserWindow }, [c, d]) => BrowserWindow.getAllWindows().find((w) => w.isAlwaysOnTop()).webContents.send(c, d), [channel, data]);
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
  test('Musik: ohne Helfer ein sauberer Leerzustand; Wiedergabe zeigt Seite und Kachel, die Notch tanzt mit blauer Kante', async () => {
    nikki = await launch();
    const { page, app } = nikki;
    const tile = page.locator('#homeTiles [data-tile="music"]');
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

    assert.equal(await tile.locator('.musicTileTitle').textContent(), 'Testlied');
    assert.equal(await tile.locator('.tileSub').textContent(), 'Nikki · Spotify');

    // closed: no title beside the eyes, they dance, the edge turns music blue
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.getElementById('island').dataset.mood === 'music');
    assert.equal(await page.getAttribute('#glow', 'data-glow'), 'music');
    assert.equal(await page.evaluate(() => document.getElementById('notch').textContent.includes('Testlied')), false);
    const glowColor = () => page.evaluate(() => getComputedStyle(document.getElementById('glow')).getPropertyValue('--glow').trim());
    assert.equal(await glowColor(), '#c9d9ff');
    // a cover with a colour of its own tints the edge (main sends it as color)
    await fromMain('media', { app: 'Spotify.exe', title: 'Testlied', artist: 'Nikki', status: 'playing', position: 15, duration: 200, updatedAt: Date.now(), cover: 'data:image/jpeg;base64,AA==', color: '#f5a3b0' });
    await page.waitForFunction(() => getComputedStyle(document.getElementById('glow')).getPropertyValue('--glow').trim() === '#f5a3b0', null, { timeout: 4000 });
    await fromMain('media', { app: 'Spotify.exe', title: 'Testlied', artist: 'Nikki', status: 'paused', position: 14, duration: 200, updatedAt: Date.now(), cover: '' });
    await page.waitForFunction(() => document.getElementById('glow').dataset.glow === 'idle', null, { timeout: 4000 });
    assert.deepEqual(nikki.errors, []);
  });

  test('Songtexte: die Zeile zur Position steht auf Seite und Kachel, ein Text zu einem anderen Lied nicht', async () => {
    nikki = await launch();
    const { page } = nikki;
    const song = { app: 'Spotify.exe', title: 'Testlied', artist: 'Nikki', status: 'playing', position: 10, duration: 200, updatedAt: Date.now(), cover: '' };
    await fromMain('media', song);
    await page.click('#tabs .tab[data-view="music"]');
    await page.waitForSelector('.mod-music .musicTitle:has-text("Testlied")');
    assert.equal(await page.locator('.musicLyric').count(), 0, 'ohne Songtexte keine Zeile');
    await fromMain('lyrics', { title: 'Anderes Lied', artist: 'Nikki', lines: [{ t: 0, text: 'falsch' }] });
    await page.waitForTimeout(400);
    assert.equal(await page.locator('.musicLyric').count(), 0, 'ein Text zu einem anderen Lied zählt nicht');
    await fromMain('lyrics', { title: 'Testlied', artist: 'Nikki', lines: [{ t: 0, text: 'erste Zeile' }, { t: 9, text: 'zweite Zeile' }, { t: 500, text: 'viel später' }] });
    await until(() => page.evaluate(() => document.querySelector('.mod-music .musicLyric')?.textContent === 'zweite Zeile'), 'Zeile auf der Seite');
    await page.click('#tabs .tab[data-view="home"]');
    await until(() => page.evaluate(() => document.querySelector('#homeTiles [data-tile="music"] .musicLyric')?.textContent === 'zweite Zeile'), 'Zeile auf der Kachel');
    assert.deepEqual(nikki.errors, []);
  });

  test('Mitteilungen: eine neue Meldung steht auf der Seite, die Kante leuchtet kurz weiß; ohne Zugriff ein Hinweis', async () => {
    nikki = await launch({ state: { modules: [{ id: 'music', on: true }, { id: 'notifications', on: true }] } });
    const { page } = nikki;
    await page.click('#tabs .tab[data-view="notifications"]');
    await page.waitForSelector('.mod-notifications .shelfEmpty');
    // what main sends when the helper saw a new notification (the helper does not run in e2e)
    await fromMain('toasts', { access: true, items: [{ id: 7, app: 'Outlook', title: 'Neue Mail', body: 'Treffen um 15 Uhr?', at: Date.now() }] });
    await page.waitForSelector('.mod-notifications .toastTitle:has-text("Neue Mail")');
    assert.equal(await page.textContent('.mod-notifications .toastApp'), 'Outlook');
    assert.equal(await page.textContent('.mod-notifications .toastBody'), 'Treffen um 15 Uhr?');
    await page.keyboard.press('Escape');
    await until(() => page.evaluate(() => document.getElementById('glow').dataset.glow === 'notify'), 'weiße Kante');
    await until(() => page.evaluate(() => document.getElementById('glow').dataset.glow === 'idle'), 'wieder die weiße Kante', 8000);
    await fromMain('toasts', { access: false, items: [] });
    await page.click('#notch');
    await page.click('#tabs .tab[data-view="notifications"]');
    await page.waitForSelector('.mod-notifications .toastHint');
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
    // added behind the page's back: opening it again reads the folder; the shelf has no Home tile
    await page.click('#tabs .tab[data-view="home"]');
    assert.equal(await page.locator('#homeTiles [data-tile="shelf"]').count(), 0);
    await page.click('#tabs .tab[data-view="shelf"]');
    await page.waitForSelector('.shelfItem:has-text("notiz (2).txt")');

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
    const s = await nikki.settings('general');
    await s.click('#setAwake');
    await until(async () => (await app.evaluate(() => globalThis.awake)).length === 1, 'Wachhalten an');
    assert.equal(nikki.state().keepAwake, true);
    await s.click('#setAwake');
    await until(async () => (await app.evaluate(() => globalThis.awake)).length === 2, 'Wachhalten aus');
    assert.deepEqual(await app.evaluate(() => globalThis.awake), ['prevent-display-sleep', 'stop 7']);
  });

  test('Paw: die Frage geht an Pawprint, die Antwort steht mit klickbaren Quellen auf der Seite, ein Fehler kommt als Text', async () => {
    // a script plays pawprint.exe (e2e/fake-pawprint.mjs): the real way through main, the IPC and the page, only the program is fake
    nikki = await launch({ state: { modules: [{ id: 'paw', on: true }] }, extraEnv: { NIKKI_E2E_PAW: path.join(root, 'e2e', 'fake-pawprint.mjs') } });
    const { page } = nikki;
    await page.click('#tabs .tab[data-view="paw"]');
    await page.waitForSelector('.mod-paw .pawInput');
    await page.fill('.mod-paw .pawInput', 'Wie viele Stage-Eingänge gibt es für Kanto?');
    await page.press('.mod-paw .pawInput', 'Enter');
    await page.waitForSelector('.mod-paw .pawStatus[role="status"]'); // "Pawprint startet …" while the server comes up
    assert.equal(await page.isDisabled('.mod-paw .pawInput'), true);
    await page.waitForSelector('.mod-paw .pawAnswer strong:has-text("34")', { timeout: 30000 });
    assert.equal(await page.textContent('.mod-paw .pawAnswer code'), 'campaign.json');
    assert.equal(await page.locator('.mod-paw .pawAnswer b').count(), 0, 'markup in an answer stays text');
    assert.match(await page.textContent('.mod-paw .pawAnswer'), /<b>kein Markup<\/b>/);
    // Nikki started it with a free port, its own pid as parent, and no secret on the command line
    await page.click('.mod-paw .pawRef:has-text("[Quelle 1]")');
    assert.equal(await page.getAttribute('.mod-paw .pawSrc[data-n="1"]', 'open'), '');
    const shown = await page.textContent('.mod-paw .pawSrc[data-n="1"] pre');
    assert.match(shown, /serve --port \d+ --parent-pid \d+/);
    assert.doesNotMatch(shown, /token/i);
    assert.equal(await page.isDisabled('.mod-paw .pawInput'), false);
    // a long answer with many sources scrolls inside the page; the last source can be reached and opened
    await page.fill('.mod-paw .pawInput', 'lang');
    await page.press('.mod-paw .pawInput', 'Enter');
    await page.waitForSelector('.mod-paw .pawSrc[data-n="6"]', { timeout: 30000 });
    const box = await page.$eval('.mod-paw .pawResult', (el) => ({ scroll: el.scrollHeight, client: el.clientHeight, overflow: getComputedStyle(el).overflowY }));
    assert.ok(box.scroll > box.client && box.overflow === 'auto', JSON.stringify(box));
    await page.click('.mod-paw .pawRef:has-text("[Quelle 6]")');
    await until(() => page.evaluate(() => {
      const r = document.querySelector('.mod-paw .pawResult').getBoundingClientRect();
      const s = document.querySelector('.mod-paw .pawSrc[data-n="6"] summary').getBoundingClientRect();
      return document.querySelector('.mod-paw .pawSrc[data-n="6"]').open && s.top >= r.top && s.bottom <= r.bottom;
    }), 'Quelle 6 sichtbar in der Liste');
    assert.ok((await page.locator('.mod-paw .pawInput').boundingBox()).y >= 0, 'the question box stays in view');
    await page.fill('.mod-paw .pawInput', 'kaputt');
    await page.press('.mod-paw .pawInput', 'Enter');
    await page.waitForSelector('.mod-paw .pawStatus.bad:has-text("Claude hat nicht geantwortet. Bist du eingeloggt?")', { timeout: 30000 });
    assert.deepEqual(nikki.errors, []);
  });
});
