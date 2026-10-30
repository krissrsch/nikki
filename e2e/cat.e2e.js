// Nikki the cat: she sits in the Claude tile, jumps out before the tab changes, peeks over an edge on the other pages.
// And the light edge reaches across the whole display (the window is as wide as the screen).
import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';
import { launch, until } from './nikki.js';

let nikki;
afterEach(async () => {
  await nikki?.close();
  nikki = null;
});
const shown = () => nikki.page.$$eval('.view:not([hidden])', (v) => v.map((x) => x.id));
const rest = () => nikki.page.$eval('.catRest', (el) => ({ type: el.dataset.type, mood: el.querySelector('.cat').dataset.mood, h: el.offsetHeight }));

describe('Nikki die Katze', () => {
  test('sitzt in der Claude-Kachel, lugt im Chat über die Eingabe', async () => {
    nikki = await launch();
    const { page } = nikki;
    await until(async () => (await rest()).type === 'sit', 'sitzt in Home');
    await page.waitForTimeout(500); // the page's own fade-in moves the tile for a moment
    const tile = await page.$eval('[data-tile="claude"]', (t) => t.getBoundingClientRect().toJSON());
    const cat = await page.$eval('.catRest', (t) => t.getBoundingClientRect().toJSON());
    assert.ok(cat.right <= tile.right && cat.bottom <= tile.bottom + 1.5 && cat.left > tile.left + tile.width / 2, `unten rechts in der Kachel: ${JSON.stringify({ cat, tile })}`);
    await page.click('#tabs .tab[data-view="chat"]');
    await until(async () => (await rest()).type === 'peek', 'lugt im Chat');
    await page.waitForTimeout(500);
    const comp = await page.$eval('#composer', (t) => t.getBoundingClientRect().toJSON());
    const c = await page.$eval('.catRest', (t) => t.getBoundingClientRect().toJSON());
    assert.ok(Math.abs(c.bottom - comp.top) <= 1.5, 'die Unterkante des sichtbaren Teils liegt auf der Eingabe');
    assert.deepEqual(nikki.errors, []);
  });

  test('mit Sprung: erst springt sie, dann wechselt der Tab, dann ist sie in der neuen Ansicht', async () => {
    nikki = await launch({ state: { catJump: true } });
    const { page } = nikki;
    await page.waitForTimeout(400);
    await page.click('#tabs .tab[data-view="chat"]');
    await page.waitForTimeout(150);
    assert.deepEqual(await shown(), ['viewHome'], 'die alte Ansicht steht noch, solange sie springt');
    assert.equal(await page.$eval('.catFly', (e) => e.hidden), false, 'sie fliegt');
    await until(async () => (await shown())[0] === 'viewChat', 'der Tab wechselt danach', 3000);
    await until(async () => (await rest()).type === 'peek' && (await page.$eval('.catFly', (e) => e.hidden)), 'sie ist angekommen', 3000);
    // und zurück: sie taucht ab, bevor Heute erscheint
    await page.waitForTimeout(1000);
    await page.click('#tabs .tab[data-view="home"]');
    await page.waitForTimeout(100);
    assert.deepEqual(await shown(), ['viewChat']);
    await until(async () => (await shown())[0] === 'viewHome' && (await rest()).type === 'sit', 'wieder in der Kachel', 3000);
    assert.deepEqual(nikki.errors, []);
  });

  test('ziehen: sie bleibt dort, je Ansicht und nach dem Neustart des Fensters; Doppelklick schickt sie zurück', async () => {
    nikki = await launch();
    const { page } = nikki;
    await page.waitForTimeout(600);
    const pos = () => page.$eval('.catRest', (e) => ({ left: e.offsetLeft, top: e.offsetTop, type: e.dataset.type }));
    const home = await pos();
    const box = await page.$eval('.catRest .catIn', (e) => e.getBoundingClientRect().toJSON());
    await page.mouse.move(box.x + 46, box.y + 50);
    await page.mouse.down();
    await page.mouse.move(box.x - 60, box.y + 80, { steps: 6 });
    assert.equal(await page.$eval('.catRest', (e) => e.classList.contains('held')), true, 'sie hängt an der Maus');
    await page.mouse.move(box.x - 150, box.y + 120, { steps: 6 });
    await page.mouse.up();
    const moved = await pos();
    assert.deepEqual([moved.left, moved.top], [home.left - 196, home.top + 120 - 50]);
    await page.click('#tabs .tab[data-view="todo"]');
    const todo = await pos();
    assert.equal(todo.type, 'peek', 'der Platz gilt nur für diese Ansicht');
    await page.click('#tabs .tab[data-view="home"]');
    assert.deepEqual(await pos(), moved);
    await page.reload();
    await page.waitForTimeout(800);
    assert.deepEqual(await pos(), moved, 'nach dem Neuladen noch dort');
    await page.dblclick('.catRest .catIn');
    await until(async () => (await pos()).left === home.left, 'zurück in der Kachel');
    assert.deepEqual(nikki.errors, []);
  });

  test('Klick: sie federt, reagiert und bleibt nicht hängen; die Kachel zeigt den Zustand nur als Punkt', async () => {
    nikki = await launch({ state: { projects: ['C:/proj/demo'], current: 'C:/proj/demo' } });
    const { page } = nikki;
    await page.waitForTimeout(600);
    const face = () => page.$eval('.catRest .cat', (e) => ({ mood: e.dataset.mood, moving: e.getAnimations().length }));
    await page.click('.catRest .catIn');
    const after = await face();
    assert.equal(after.mood, 'purr');
    assert.ok(after.moving > 0, 'die Sprung-Animation läuft');
    await until(async () => (await face()).moving === 0, 'die Animation endet');
    assert.equal(await page.$$eval('#claudeSessions .sState', (e) => e.length), 0, 'keine Zustandswörter');
    assert.deepEqual(nikki.errors, []);
  });

  test('Töne: jeder klingt, keiner übersteuert, jeder verklingt von selbst', async () => {
    nikki = await launch();
    const levels = await nikki.page.evaluate(async () => {
      const out = {};
      for (const name of Object.keys(NIKKI_SOUNDS)) {
        const ctx = new OfflineAudioContext(1, 44100 * 2, 44100);
        playSound(ctx, soundRoom(ctx), name);
        const d = (await ctx.startRendering()).getChannelData(0);
        const peak = (from, to) => d.subarray(from, to).reduce((m, x) => Math.max(m, Math.abs(x)), 0);
        out[name] = { peak: peak(0, d.length), end: peak(44100 * 1.7, d.length) };
      }
      return out;
    });
    for (const [name, l] of Object.entries(levels)) {
      assert.ok(l.peak > 0.05 && l.peak < 0.5, `${name}: ${l.peak}`);
      assert.ok(l.end < 0.002, `${name} klingt aus: ${l.end}`);
    }
    assert.deepEqual(nikki.errors, []);
  });

  test('Einstellungen: eigenes Fenster mit Seitenleiste, jede Seite zeigt nur ihres, ein zweiter Klick öffnet kein zweites Fenster', async () => {
    nikki = await launch();
    const { page, app } = nikki;
    const s = await nikki.settings();
    assert.equal(await page.getAttribute('#notch', 'aria-expanded'), 'false', 'die Insel macht Platz');
    assert.deepEqual(await s.$$eval('.sideBtn', (b) => b.map((x) => x.dataset.page)), ['general', 'notch', 'today', 'modules', 'claude', 'nikki', 'keys']);
    for (const id of ['general', 'notch', 'today', 'modules', 'claude', 'nikki', 'keys']) {
      await s.click(`.sideBtn[data-page="${id}"]`);
      assert.deepEqual(await s.$$eval('.sPage:not([hidden])', (p) => p.map((x) => x.dataset.page)), [id]);
      assert.equal(await s.getAttribute(`.sideBtn[data-page="${id}"]`, 'aria-current'), 'page');
    }
    assert.equal(await s.locator('#setModuleList .modRow').count(), 7, 'alle Module mit Icon und Schalter');
    // Plätze zurücksetzen wirkt in der Insel
    await page.evaluate(() => localStorage.setItem('nikki.catPlaces', '{"home":{"left":20,"top":100}}'));
    await page.reload();
    await page.waitForFunction(() => document.querySelector('.catRest').offsetLeft === 20);
    await s.click('.sideBtn[data-page="nikki"]');
    await s.click('#setCatPlaces');
    await page.waitForFunction(() => document.querySelector('.catRest').offsetLeft !== 20);
    await page.click('#openSettings');
    await page.waitForTimeout(400);
    assert.equal(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length), 2);
    assert.deepEqual(nikki.errors, []);
  });

  test('Start-Intro: sie kommt aus der Notch, landet auf ihrem Platz; ein Klick auf die Notch beendet es sofort', async () => {
    nikki = await launch({ state: { intro: true } });
    const { page } = nikki;
    await page.waitForFunction(() => !document.getElementById('introStage'), null, { timeout: 3000 }); // nothing stays behind
    assert.equal(await page.$eval('.catRest', (e) => getComputedStyle(e).visibility), 'visible');
    assert.equal(await page.$eval('.catRest', (e) => e.dataset.type), 'sit');
    assert.equal(await page.getAttribute('#glow', 'data-glow'), '');
    // noch einmal von vorn, mittendrin geöffnet
    await page.click('#tabs', { position: { x: 500, y: 17 } });
    await page.waitForFunction(() => !document.getElementById('island').classList.contains('open'));
    await page.evaluate(() => {
      island.classList.add('boot');
      window.run = startUp();
    });
    await page.waitForFunction(() => document.getElementById('island').classList.contains('greeting'));
    await page.waitForTimeout(900);
    assert.equal(await page.$eval('#island', (e) => e.offsetWidth), 640, 'die Begrüßung läuft im Banner der Insel');
    await page.click('#notch');
    await page.evaluate(() => window.run);
    assert.equal(await page.locator('#introStage').count(), 0);
    assert.equal(await page.$eval('#island', (e) => e.classList.contains('greeting')), false);
    assert.equal(await page.$eval('.catRest', (e) => getComputedStyle(e).visibility), 'visible');
    assert.deepEqual(nikki.errors, []);
  });

  test('die Lichtkante läuft über den ganzen Bildschirm: das Fenster ist so breit wie die Anzeige', async () => {
    nikki = await launch();
    const { app } = nikki;
    const { win, display } = await app.evaluate(({ BrowserWindow, screen }) => {
      const w = BrowserWindow.getAllWindows().find((w) => w.isAlwaysOnTop()).getBounds();
      return { win: w, display: screen.getDisplayMatching(w).bounds };
    });
    assert.equal(win.x, display.x);
    assert.equal(win.width, Math.max(1200, display.width));
    const rim = await nikki.page.$eval('#glow', (g) => ({ w: g.getBoundingClientRect().width, v: g.getAttribute('viewBox') }));
    assert.ok(rim.w >= win.width, 'die Linie reicht bis zu den Rändern');
  });
});
