// Clipboard module (opt-in) against the real Windows clipboard. The user's clipboard is saved before and put back after
// (e2e/win-clipboard.js); the test's own texts are marked so they never reach the clipboard history (Win+V).
// Nikki's own "copy again" is recorded instead of written, for the same reason.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';
import { launch, rm, tmpDir, until } from './nikki.js';
import { clipboardText, restoreClipboard, saveClipboard, setClipboardText } from './win-clipboard.js';

describe('Zwischenablage', () => {
  let nikki;
  const dir = tmpDir('clip');
  const snapshot = path.join(dir, 'vorher.txt');
  const stamp = Date.now();
  const FIRST = `nikki-e2e eins ${stamp}`;
  const SECOND = `nikki-e2e zwei ${stamp}`;
  const SECRET = `nikki-e2e geheim ${stamp}`;
  before(() => saveClipboard(snapshot));
  after(async () => {
    await nikki?.close();
    // only while it still holds a test text: whatever the user copied meanwhile stays
    if ([FIRST, SECOND, SECRET].includes(clipboardText())) restoreClipboard(snapshot);
    rm(dir);
  });

  test('ab Werk aus; an: Kopiertes erscheint, Passwort-Manager bleibt draußen, Klick kopiert, „An Chat“, merken und löschen', async () => {
    nikki = await launch();
    const { page, app } = nikki;
    const file = path.join(nikki.userData, 'clipboard.json');
    await page.click('#tabs .tab[data-view="settings"]');
    assert.equal(await page.isChecked('#mod-clipboard'), false, 'ab Werk aus');
    assert.equal(await page.locator('#moduleTabs .tab[data-view="clipboard"]').count(), 0);

    // on the clipboard as Nikki is switched on: a copy a password manager marked as not for monitors
    setClipboardText(SECRET, { exclude: true });
    await page.click('#mod-clipboard');
    await page.waitForSelector('#moduleTabs .tab[data-view="clipboard"]');
    await page.waitForTimeout(1500); // one look at the marked copy
    setClipboardText(FIRST);
    await page.click('#tabs .tab[data-view="clipboard"]');
    await page.waitForSelector(`.clipText:text-is("${FIRST}")`);
    setClipboardText(SECOND);
    await page.waitForSelector(`.clipRow:first-child .clipText:text-is("${SECOND}")`);
    assert.equal(await page.locator('.clipText', { hasText: 'geheim' }).count(), 0, 'vom Passwort-Manager markiert');
    assert.equal(fs.existsSync(file), false, 'nur im Speicher');
    const tile = page.locator('#homeTiles .modTile', { has: page.locator('button.tileHead', { hasText: 'Zwischenablage' }) });
    assert.match(await tile.textContent(), new RegExp(`2 Einträge.*${SECOND}.*${FIRST}`));

    // click copies again (recorded, see above) and moves it up
    await app.evaluate(({ clipboard }) => {
      globalThis.copied = [];
      clipboard.writeText = (t) => globalThis.copied.push(t);
    });
    await page.click(`.clipText:text-is("${FIRST}")`);
    await page.waitForSelector(`.clipRow:first-child .clipText:text-is("${FIRST}")`);
    assert.deepEqual(await app.evaluate(() => globalThis.copied), [FIRST]);
    assert.equal(await page.textContent('.shelfInfo'), 'Kopiert.');
    setClipboardText(FIRST); // what the recorded write would have done, so Nikki's next look agrees

    // "Verlauf merken" writes the file, off deletes it
    await page.click('#clipKeep');
    const saved = await until(() => fs.existsSync(file) && JSON.parse(fs.readFileSync(file, 'utf8')), 'clipboard.json');
    assert.deepEqual(saved.items.map((c) => c.text), [FIRST, SECOND]);
    assert.equal(nikki.state().clipKeep, true);
    await page.click('#clipKeep');
    await until(() => !fs.existsSync(file), 'clipboard.json gelöscht');

    await nikki.fakeClaude();
    await page.click('.clipRow:first-child .todoChat');
    assert.equal(await page.inputValue('#prompt'), FIRST);
    assert.equal(await page.getAttribute('#tabs .tab[data-view="chat"]', 'aria-pressed'), 'true');
    assert.deepEqual((await nikki.calls()).starts, [], 'nicht abgeschickt');

    await page.click('#tabs .tab[data-view="clipboard"]');
    await page.click('.clipRow:first-child .iconBtn');
    await page.waitForSelector(`.clipText:text-is("${FIRST}")`, { state: 'detached' });
    assert.equal(await page.locator('.clipRow').count(), 1);
    await page.click('.shelfBar button:has-text("Alles löschen")');
    await page.waitForSelector('.mod-clipboard .shelfEmpty');
    assert.deepEqual(nikki.errors, []);
  });
});
