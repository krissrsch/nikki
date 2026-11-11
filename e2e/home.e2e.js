// Home "Heute" (canvas Glas): exactly four tiles, and the weather from main. Open-Meteo is replaced in main (net.fetch), so the run stays offline.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, test } from 'node:test';
import { launch, until } from './nikki.js';

let nikki;
afterEach(async () => {
  await nikki?.close();
  nikki = null;
});
const fromMain = (channel, data) => nikki.app.evaluate(({ BrowserWindow }, [c, d]) => BrowserWindow.getAllWindows().find((w) => w.isAlwaysOnTop()).webContents.send(c, d), [channel, data]);
// the tiles in the order they show (CSS order keeps their places)
const tiles = () => nikki.page.$$eval('#homeTiles > .tile', (t) => t.sort((a, b) => getComputedStyle(a).order - getComputedStyle(b).order).map((x) => x.dataset.tile));

describe('Home „Heute“', () => {
  test('erster Start: Begrüßung statt Kacheln, Ordner wählen hakt ab, „Los geht’s“ merkt es sich', async () => {
    nikki = await launch({ state: { welcomed: false } });
    const { page } = nikki;
    await page.waitForSelector('#welcome:not([hidden])');
    assert.equal(await page.isHidden('#homeTiles'), true);
    assert.match(await page.textContent('#welcome'), /Hallo, ich bin Nikki/);
    assert.match(await page.textContent('#welcome'), /drück Strg\+Alt\+/);
    assert.equal(await page.locator('.welcomeStep:not(.ok)').count(), 1, 'nur der Projektordner fehlt noch');
    const dir = fs.mkdtempSync(path.join(nikki.userData, 'meine-app-'));
    await nikki.pickFolderReturns(dir);
    await page.click('#welcome button:has-text("Ordner wählen")');
    await until(async () => (await page.locator('.welcomeStep:not(.ok)').count()) === 0, 'Ordner abgehakt');
    assert.match(await page.textContent('#welcome'), new RegExp(`${path.basename(dir)} ist dabei`));
    await page.click('#welcome button:has-text("Los geht’s")');
    await until(() => nikki.state().welcomed === true, 'gemerkt');
    await page.waitForSelector('#welcome', { state: 'hidden' });
    assert.deepEqual(await tiles(), ['claude', 'music', 'weather', 'calendar']);
    assert.deepEqual(nikki.errors, []);
  });

  test('Augen folgen der Maus; die ruhende Maus öffnet die Notch nur mit Einstellung, wegziehen bricht ab', async () => {
    nikki = await launch();
    const { page } = nikki;
    const s = await nikki.settings('notch');
    await s.selectOption('#setHoverOpen', '300');
    await s.close();
    await until(() => page.evaluate(() => document.getElementById('notch').getAttribute('aria-expanded') === 'false'), 'Insel zu');
    const c = await page.evaluate(() => {
      const r = document.getElementById('notch').getBoundingClientRect();
      return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
    });
    await fromMain('pointer', { x: c.x + 400, y: 300 });
    await until(() => page.evaluate(() => parseFloat(document.getElementById('eyes').style.translate) > 2), 'Augen rechts, ein sichtbarer Blick');
    await fromMain('pointer', c);
    await fromMain('pointer', { x: c.x + 400, y: 300 });
    await new Promise((r) => setTimeout(r, 450));
    assert.equal(await page.getAttribute('#notch', 'aria-expanded'), 'false');
    await fromMain('pointer', c);
    await until(() => page.evaluate(() => document.getElementById('notch').getAttribute('aria-expanded') === 'true'), 'Insel offen');
    await page.waitForFunction(() => document.querySelector('.c-gaze')?.style.transform);
    assert.deepEqual(nikki.errors, []);
  });

  test('Hover-Öffnen: nach Esc nicht gleich wieder auf; per Hover geöffnet schließt beim Wegfahren, nach einem Klick hinein nicht', async () => {
    nikki = await launch();
    const { page } = nikki;
    const s = await nikki.settings('notch');
    await s.selectOption('#setHoverOpen', '300');
    await s.close();
    let step = 0;
    const expanded = (v) => until(() => page.evaluate((x) => document.getElementById('notch').getAttribute('aria-expanded') === x, String(v)), `Insel ${v ? 'offen' : 'zu'} (Schritt ${++step})`);
    const c = await page.evaluate(() => {
      const r = document.getElementById('notch').getBoundingClientRect();
      return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
    });
    const away = { x: c.x + 700, y: 500 };
    await expanded(false);
    // opened by a click, closed by Esc, the pointer rests on the notch: it must stay closed
    await page.click('#notch');
    await expanded(true);
    await page.keyboard.press('Escape');
    await expanded(false);
    await fromMain('pointer', c);
    await new Promise((r) => setTimeout(r, 700));
    assert.equal(await page.getAttribute('#notch', 'aria-expanded'), 'false');
    // away and back: opens; away again: closes by itself
    await fromMain('pointer', away);
    await fromMain('pointer', c);
    await expanded(true);
    await fromMain('pointer', away);
    await expanded(false);
    // away, back, open; a click into it makes it an ordinary open island: it stays when the pointer leaves
    await fromMain('pointer', c);
    await expanded(true);
    await page.click('#island');
    await fromMain('pointer', away);
    await new Promise((r) => setTimeout(r, 900));
    assert.equal(await page.getAttribute('#notch', 'aria-expanded'), 'true');
    assert.deepEqual(nikki.errors, []);
  });

  test('Sounds-Ordner: eine Datei ersetzt den Ton sofort, und der Ordner gibt nur Töne heraus', async () => {
    nikki = await launch();
    const { page, app } = nikki;
    const dir = path.join(await app.evaluate(({ app: a }) => a.getPath('userData')), 'sounds');
    await page.evaluate(() => {
      window.ownPlayed = 0;
      const make = AudioContext.prototype.createBufferSource;
      AudioContext.prototype.createBufferSource = function () {
        window.ownPlayed++;
        return make.call(this);
      };
    });
    const wav = Buffer.alloc(44 + 800);
    wav.write('RIFF', 0); wav.writeUInt32LE(36 + 800, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
    wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(8000, 28); wav.writeUInt16LE(1, 32); wav.writeUInt16LE(8, 34); wav.write('data', 36); wav.writeUInt32LE(800, 40);
    fs.writeFileSync(path.join(dir, 'done.wav'), wav);
    fs.writeFileSync(path.join(dir, 'secret.wav'), wav);
    await until(async () => {
      await fromMain('terminal', { sessions: [], changed: 'done' });
      return page.evaluate(() => window.ownPlayed > 0);
    }, 'eigener Ton gespielt');
    const status = (url) => page.evaluate((u) => fetch(u).then((r) => r.status), url);
    assert.equal(await status('/user-sounds/done.wav'), 200);
    assert.equal(await status('/user-sounds/secret.wav'), 404);
    assert.equal(await status('/user-sounds/..%2F..%2Fstate.json'), 404);
    assert.deepEqual(nikki.errors.filter((e) => !e.includes('404')), []); // the two refused files above
  });

  test('Claude-Kachel: Limits als zwei Ringe statt Session-Zahl, ohne Daten keine Ringe; Terminal-Zeile springt zum Fenster und schließt die Insel', async () => {
    nikki = await launch();
    const { page, app } = nikki;
    await fromMain('terminal', { sessions: [{ id: 'term-1', cwd: 'C:/p/demo', state: 'working', text: 'x', at: 1 }] });
    await page.waitForSelector('button.sRow');
    assert.equal(await page.isVisible('#usage'), false);
    assert.equal(await page.isVisible('#claudeMeta'), true);
    const soon = (h) => new Date(Date.now() + h * 3600e3).toISOString();
    // a window whose time has passed is not shown any more; the other one is
    await fromMain('usage', { session: { percent: 10, resets: '2020-01-01T00:00:00Z' }, week: { percent: 98, resets: soon(30) } });
    await page.waitForSelector('#usage .uRing');
    assert.deepEqual(await page.$$eval('.uRing', (r) => r.map((x) => x.textContent)), ['Woche 98 %']);
    await fromMain('usage', { session: { percent: 10, resets: soon(2) }, week: { percent: 98, resets: soon(30) } });
    await page.waitForFunction(() => document.querySelectorAll('.uRing').length === 2);
    assert.deepEqual(await page.$$eval('.uRing', (r) => r.map((x) => [x.textContent, x.dataset.level])), [['5 h 10 %', 'ok'], ['Woche 98 %', 'bad']]);
    await page.focus('.uRing >> nth=1'); // by keyboard the details show too
    await page.waitForFunction(() => getComputedStyle(document.querySelectorAll('.uRing')[1], '::after').visibility === 'visible');
    assert.match(await page.getAttribute('.uRing >> nth=1', 'aria-label'), /^Wochenlimit: 98 % verbraucht, wieder frei \w+, \d\d:\d\d Uhr$/);
    assert.equal(await page.isVisible('#claudeMeta'), false);
    if (process.env.NIKKI_SHOT) await page.locator('#island').screenshot({ path: process.env.NIKKI_SHOT });
    await app.evaluate(({ ipcMain }) => ipcMain.on('terminal-focus', (_e, id, hint) => (globalThis.focused = `${id}|${hint}`)));
    // hook events rebuild the tile all the time: the row stays the same element, so the keyboard focus is not lost
    await page.focus('button.sRow');
    await fromMain('terminal', { sessions: [{ id: 'term-1', cwd: 'C:/p/demo', state: 'needsYou', text: 'y', at: 2 }] });
    await page.waitForFunction(() => document.querySelector('button.sRow .sDot')?.dataset.state === 'needsYou');
    assert.equal(await page.evaluate(() => document.activeElement?.classList.contains('sRow')), true);
    await page.click('button.sRow');
    await until(() => app.evaluate(() => globalThis.focused === 'term-1|demo'), 'Sprung gemeldet, mit dem Ordnernamen für das richtige Fenster');
    await until(() => page.evaluate(() => document.getElementById('notch').getAttribute('aria-expanded') === 'false'), 'Insel zu');
    assert.deepEqual(nikki.errors, []);
  });

  test('genau vier Kacheln: Claude, Musik, Wetter, Kalender; ohne Stadt fragt das Wetter nach einer', async () => {
    nikki = await launch();
    const { page } = nikki;
    assert.deepEqual(await tiles(), ['claude', 'music', 'weather', 'calendar']);
    assert.equal(await page.isHidden('#welcome'), true, 'a state.json from before the welcome card counts as welcomed');
    assert.match(await page.textContent('[data-tile="calendar"] .calWeekday'), /^(Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag)$/);
    assert.equal(await page.textContent('[data-tile="calendar"] .calNum'), String(new Date().getDate()));
    assert.match(await page.textContent('[data-tile="calendar"]'), /Heute steht nichts an/);
    assert.match(await page.textContent('#weatherTile'), /Stadt in den Einstellungen eintragen/);
    const [s] = await Promise.all([nikki.app.waitForEvent('window'), page.click('#weatherTile button:has-text("Stadt eintragen")')]);
    await s.waitForFunction(() => document.activeElement?.id === 'setCity');
    assert.equal(await s.isVisible('#setCity'), true);
    assert.deepEqual(nikki.errors, []);
  });

  test('Wetter: Stadt in den Settings → main holt Ort und Vorhersage, die Kachel zeigt sie; offline der letzte Stand mit Uhrzeit', async () => {
    nikki = await launch();
    const { page, app } = nikki;
    // Open-Meteo as main would see it: geocoding, then the forecast
    await app.evaluate(({ net }) => {
      globalThis.urls = [];
      const json = (body) => new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
      const times = Array.from({ length: 24 }, (_, i) => `2026-10-30T${String(i).padStart(2, '0')}:00`);
      net.fetch = async (url) => {
        globalThis.urls.push(String(url));
        if (String(url).includes('geocoding')) return json({ results: [{ name: 'Testhausen', latitude: 52.5, longitude: 13.4 }] });
        return json({ current: { time: '2026-10-30T09:15', temperature_2m: 14.6, weather_code: 61, is_day: 1 }, hourly: { time: times, temperature_2m: times.map((_, i) => i) }, daily: { temperature_2m_max: [16.7], temperature_2m_min: [8.6] } });
      };
    });
    const s = await nikki.settings('today');
    await s.fill('#setCity', 'Testhausen');
    await s.press('#setCity', 'Enter');
    await until(() => nikki.state().weather?.temp === 15, 'Wetter im Store');
    const urls = await app.evaluate(() => globalThis.urls);
    assert.match(urls[0], /geocoding-api\.open-meteo\.com\/v1\/search\?name=Testhausen&count=1&language=de/);
    assert.match(urls[1], /api\.open-meteo\.com\/v1\/forecast\?latitude=52\.5&longitude=13\.4/);
    assert.equal(nikki.state().weatherCity, 'Testhausen');
    await page.click('#notch');
    await page.waitForSelector('#weatherTile .wTemp');
    assert.equal(await page.textContent('#weatherTile .tileHead'), 'TesthausenH 17° · T 9°');
    assert.equal(await page.textContent('#weatherTile .wTemp'), '15°');
    assert.equal(await page.textContent('#weatherTile .wText'), 'Leichter Regen');
    assert.deepEqual(await page.$$eval('#weatherTile .wHours span', (s) => s.map((x) => x.textContent)), ['1010°', '1212°', '1414°', '1616°']);
    assert.equal(await page.locator('#weatherTile svg').count(), 1, 'own icon, no emoji');

    // offline: the last answer stays, with its time
    const at = new Date(2026, 9, 30, 9, 18).getTime();
    await fromMain('weather', { ...nikki.state().weather, at, error: 'offline' });
    await until(async () => (await page.textContent('#weatherTile .wText')) === 'Leichter Regen · Stand 09:18', 'Stand mit Uhrzeit');
    await fromMain('weather', { query: 'Nirgendwo', error: 'notfound' });
    await until(async () => /kennt der Wetterdienst nicht/.test(await page.textContent('#weatherTile')), 'nicht gefunden');
    await fromMain('weather', { query: 'Testhausen', error: 'offline' });
    await until(async () => /Gerade kommt kein Wetter durch/.test(await page.textContent('#weatherTile')), 'freundlicher Hinweis');
    assert.deepEqual(nikki.errors, []);
  });
});
