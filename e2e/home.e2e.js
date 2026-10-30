// Home "Heute" (canvas Glas): exactly four tiles, and the weather from main. Open-Meteo is replaced in main (net.fetch), so the run stays offline.
import assert from 'node:assert/strict';
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
  test('genau vier Kacheln: Claude, Musik, Wetter, Kalender; ohne Stadt fragt das Wetter nach einer', async () => {
    nikki = await launch();
    const { page } = nikki;
    assert.deepEqual(await tiles(), ['claude', 'music', 'weather', 'calendar']);
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
