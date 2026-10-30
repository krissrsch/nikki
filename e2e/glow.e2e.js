// Closed notch (canvas Glow): only eyes and whiskers, the state as a light edge, the spectrum under the notch.
// Offline like app.e2e.js: status, media and spectrum frames are sent the way main would send them.
import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';
import { launch, until } from './nikki.js';

let nikki;
afterEach(async () => {
  await nikki?.close();
  nikki = null;
});
const fromMain = (channel, data) => nikki.app.evaluate(({ BrowserWindow }, [c, d]) => BrowserWindow.getAllWindows().find((w) => w.isAlwaysOnTop()).webContents.send(c, d), [channel, data]);
const glow = () => nikki.page.getAttribute('#glow', 'data-glow');
const close = async () => {
  await nikki.page.keyboard.press('Escape');
  await nikki.page.waitForFunction(() => document.getElementById('island').getBoundingClientRect().width === 110);
};
const bars = () => nikki.page.$$eval('#specBars rect', (r) => r.map((x) => Number(x.getAttribute('height'))));

describe('Notch und Glow', () => {
  test('zugeklappt: nur Augen und Schnurrhaare, keine Infos, die Notch bleibt schmal', async () => {
    nikki = await launch();
    const { page } = nikki;
    await nikki.status({ state: 'working', text: 'Bash: npm test…' });
    await fromMain('media', { app: 'Spotify.exe', title: 'Testlied', artist: 'Nikki', status: 'playing', position: 1, duration: 200, updatedAt: Date.now(), cover: '' });
    await close();
    assert.deepEqual(await page.$$eval('#notch > *', (n) => n.map((x) => x.id || x.getAttribute('class'))), ['wh whL', 'wh whR', 'eyes']);
    assert.equal(await page.evaluate(() => /Testlied|arbeitet|npm/.test(document.getElementById('notch').textContent)), false);
    assert.equal(await page.getAttribute('#island', 'data-mood'), 'work');
    assert.equal(await page.getAttribute('#notch', 'aria-label'), 'Nikki schaut zu');
    assert.equal(await glow(), 'work', 'working beats music');
    await page.waitForTimeout(500);
    assert.equal(await page.evaluate(() => document.getElementById('island').getBoundingClientRect().width), 110);
    assert.deepEqual(nikki.errors, []);
  });

  test('braucht dich setzt die gelbe Kante; offen ist sie aus; Leuchten aus nimmt sie weg, die Stärke wird gemerkt', async () => {
    nikki = await launch();
    const { page } = nikki;
    await nikki.status({ state: 'needsYou', text: 'Nikki will OK!' });
    assert.equal(await glow(), 'need');
    const look = () => page.evaluate(() => ({ opacity: getComputedStyle(document.getElementById('glow')).opacity, edge: getComputedStyle(document.querySelector('#glow stop')).stopColor }));
    await page.waitForTimeout(700);
    assert.deepEqual(await look(), { opacity: '0', edge: 'rgb(255, 200, 97)' }, 'open: the edge waits behind the island');
    await close();
    await until(async () => (await look()).opacity === '1', 'Kante sichtbar');

    await page.click('#notch');
    const s = await nikki.settings('notch');
    assert.equal(await s.isChecked('#setGlow'), true, 'ab Werk an');
    await s.selectOption('#setGlowLevel', 'kraeftig');
    await until(() => nikki.state().glowLevel === 'kraeftig', 'Stärke gespeichert');
    await until(async () => (await page.getAttribute('#glow', 'data-level')) === 'kraeftig', 'die Insel übernimmt die Stärke');
    await s.click('#setGlow');
    await until(async () => (await glow()) === '', 'Leuchten aus');
    assert.equal(nikki.state().glow, false);
    assert.equal(await s.isDisabled('#setGlowLevel'), true);
    await page.waitForTimeout(700);
    assert.equal((await look()).opacity, '0', 'needs you, but no edge');
    await s.click('#setGlow');
    await until(async () => (await glow()) === 'need', 'Leuchten wieder an');
    assert.deepEqual(nikki.errors, []);
  });

  test('Spektrum: Bänder lassen die Balken wachsen, Stille räumt sie weg und die Kante geht aus', async () => {
    nikki = await launch();
    const { page } = nikki;
    await close();
    assert.ok((await bars()).every((h) => h === 0), 'nothing drawn while quiet');
    await fromMain('spectrum', [1, 0.8, 0.6, 0.5, 0.4, 0.4, 0.3, 0.3, 0.2, 0.2, 0.1, 0.1]);
    await until(async () => (await bars())[0] > 50, 'Bass in der Mitte voll');
    const h = await bars();
    assert.equal(h.length, 24);
    assert.equal(h[0], h[1], 'mirrored');
    assert.ok(h[0] > h[22], 'bass in the middle, treble outside');
    assert.equal(await glow(), 'music', 'any system sound shows the music edge');
    await fromMain('spectrum', Array(12).fill(0));
    await until(async () => (await bars()).every((x) => x === 0), 'Balken weg');
    assert.equal(await glow(), '');
    assert.deepEqual(nikki.errors, []);
  });
});
