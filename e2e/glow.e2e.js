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

  test('ziehen: die Notch folgt der Maus, federt in die Mitte zurück, öffnet dabei nicht; ein Klick öffnet weiter', async () => {
    nikki = await launch();
    const { page } = nikki;
    await close();
    const middle = () => page.evaluate(() => {
      const r = document.getElementById('island').getBoundingClientRect();
      return Math.round(r.left + r.width / 2 - innerWidth / 2);
    });
    const box = await page.locator('#notch').boundingBox();
    const y = box.y + box.height / 2;
    const x = box.x + box.width / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 150, y, { steps: 5 });
    await until(async () => (await middle()) === 150, 'Notch folgt der Maus');
    await page.mouse.move(x + 150, y + 200); // waagerecht gebunden, auch unterhalb der Notch bleibt die Maus beim Ziehen
    assert.equal(await middle(), 150);
    await page.mouse.up();
    await until(async () => (await middle()) === 0 && !(await page.evaluate(() => document.documentElement.dataset.drag)), 'zurück in der Mitte');
    assert.equal(await page.getAttribute('#notch', 'aria-expanded'), 'false', 'Ziehen öffnet nicht');
    assert.equal(typeof nikki.state().display, 'number', 'der Bildschirm wird gemerkt');

    await page.mouse.click(x, y);
    await until(async () => (await page.getAttribute('#notch', 'aria-expanded')) === 'true', 'Klick öffnet');
    assert.deepEqual(nikki.errors, []);
  });

  test('Schließen-Taste: nur belegt, solange die Insel offen ist; Rücktaste löscht sie', async () => {
    nikki = await launch();
    const { page, app } = nikki;
    const held = (k) => app.evaluate(({ globalShortcut }, k) => globalShortcut.isRegistered(k), k);
    const s = await nikki.settings('keys');
    assert.equal(await s.textContent('#setCloseKey'), 'keins');
    await s.click('#setCloseKey');
    await s.keyboard.press('Escape');
    await until(async () => (await s.textContent('#setCloseKey')) === 'Esc', 'Esc belegt');
    assert.equal(nikki.state().closeKey, 'Escape');
    assert.equal(await held('Escape'), false, 'zu: Esc bleibt bei den anderen Programmen');
    await page.click('#notch');
    await until(() => held('Escape'), 'offen: belegt');
    await nikki.permission({ id: 9002, toolName: 'Bash', input: { command: 'echo hi' } });
    await until(async () => !(await held('Escape')), 'eine wartende Karte gibt die Taste frei');
    await fromMain('permission-cancel', 9002);
    await until(() => held('Escape'), 'Karte weg: wieder belegt');
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find((w) => w.isAlwaysOnTop()).webContents.send('close-key'));
    await until(async () => (await page.getAttribute('#notch', 'aria-expanded')) === 'false', 'geschlossen');
    await until(async () => !(await held('Escape')), 'wieder frei');
    await s.click('#setCloseKey');
    await s.keyboard.press('Backspace');
    await until(async () => (await s.textContent('#setCloseKey')) === 'keins', 'gelöscht');
    assert.equal(nikki.state().closeKey, null);
    assert.deepEqual(nikki.errors, []);
  });

  test('Nikki schaut hinter der Notch hervor: wenn sie gebraucht wird, an einer Seite, nie bei offener Insel', async () => {
    nikki = await launch();
    const { page } = nikki;
    await close();
    const out = () => page.evaluate(() => document.getElementById('notchPeek').hasAttribute('data-on'));
    assert.equal(await out(), false);
    await nikki.status({ state: 'needsYou', text: 'Nikki will OK!' });
    await until(out, 'sie schaut raus');
    const side = await page.getAttribute('#notchPeek', 'data-side');
    assert.ok(['L', 'R'].includes(side));
    assert.equal(await page.getAttribute('#island', 'data-peek'), side, 'das Schnurrhaar dieser Seite macht Platz');
    assert.equal(await page.$eval('#eyes', (e) => getComputedStyle(e).display), 'block', 'die Augen der Notch bleiben');
    await page.click('#notch');
    await until(async () => !(await out()), 'offen: weg');
    assert.equal(await page.getAttribute('#island', 'data-peek'), null);
    assert.deepEqual(nikki.errors, []);
  });

  test('Discord: Modul zeigt Zustände und die Leute im Kanal; das Secret bleibt verschlüsselt und kommt nicht zurück', async () => {
    const modules = [{ id: 'discord', on: true }];
    nikki = await launch({ state: { modules } });
    const { page } = nikki;
    await page.click('.tab[data-view="discord"]');
    await page.waitForSelector('#view-discord .dcEmpty');
    assert.match(await page.textContent('#view-discord'), /noch nicht verbunden/);
    await fromMain('discord', { status: 'nodiscord', channel: null, people: [], error: null });
    await until(async () => /Discord läuft nicht/.test(await page.textContent('#view-discord')), 'Zustand');
    await fromMain('discord', { status: 'live', channel: { name: 'Lounge', guild: 'Server' }, people: [{ id: '1', name: 'Ali', avatar: null, muted: true, deaf: false, speaking: true }, { id: '2', name: 'Bo', avatar: null, muted: false, deaf: true, speaking: false }], error: null });
    await until(async () => (await page.locator('.dcRow').count()) === 2, 'Liste');
    assert.match(await page.textContent('.dcHead'), /Lounge.*Server.*2 Personen/s);
    assert.equal(await page.locator('.dcRow .talk').count(), 1);
    assert.match(await page.textContent('#view-discord'), /stumm.*taub/s);

    const s = await nikki.settings('discord');
    await s.fill('#setDiscordId', 'keine-zahl');
    await s.press('#setDiscordId', 'Tab');
    await until(async () => /keine gültige/.test(await s.textContent('#discordMsg')), 'Fehler bei falscher ID');
    await s.fill('#setDiscordId', '1234567890');
    await s.press('#setDiscordId', 'Tab');
    await until(() => nikki.state().discord?.clientId === '1234567890', 'ID gespeichert');
    await s.fill('#setDiscordSecret', 'streng-geheim');
    await s.press('#setDiscordSecret', 'Tab');
    await until(() => nikki.state().discord?.secret, 'Secret gespeichert');
    assert.ok(!JSON.stringify(nikki.state()).includes('streng-geheim'), 'nicht im Klartext');
    assert.equal(await s.inputValue('#setDiscordSecret'), '');
    assert.equal(await s.getAttribute('#setDiscordSecret', 'placeholder'), 'gespeichert');
    assert.deepEqual(nikki.errors, []);
  });

  test('Mikrofon im Spektrum: ab Werk aus, gespeichert, aus mit dem Leuchten', async () => {
    nikki = await launch();
    const s = await nikki.settings('notch');
    assert.equal(await s.isChecked('#setMic'), false);
    await s.click('#setMic');
    await until(() => nikki.state().micSpectrum === true, 'gespeichert');
    await s.click('#setGlow');
    await until(() => s.isDisabled('#setMic'), 'ohne Leuchten nicht wählbar');
    assert.deepEqual(nikki.errors, []);
  });
});
