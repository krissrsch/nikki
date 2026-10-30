// An error from the Claude CLI reaches the island in German, the CLI's own words collapsed under "Details".
// Offline: the temp home's claude.exe is an empty file (e2e/nikki.js), so the real backend fails to start it.
import assert from 'node:assert/strict';
import { after, describe, test } from 'node:test';
import { launch, rm, tmpDir } from './nikki.js';

describe('Fehlertexte', () => {
  let nikki;
  const project = tmpDir('projErr');
  after(async () => {
    await nikki?.close();
    rm(project);
  });

  test('Ein CLI-Fehler erscheint kurz auf Deutsch, das Original unter „Details“', async () => {
    nikki = await launch({ state: { projects: [project] } });
    const { page } = nikki;
    await nikki.openChat();
    await nikki.send('Hallo');
    await page.waitForSelector('#answer.error .errDetail', { timeout: 20000 });
    const out = await page.evaluate(() => {
      const a = document.getElementById('answer');
      const d = a.querySelector('.errDetail');
      return { text: a.firstChild.textContent, open: d.open, summary: d.querySelector('summary').textContent, detail: d.querySelector('pre').textContent };
    });
    assert.equal(out.summary, 'Details');
    assert.equal(out.open, false, 'eingeklappt');
    assert.ok(out.detail.trim(), 'das Original bleibt erhalten');
    assert.notEqual(out.text.trim(), out.detail.trim());
    assert.match(out.text, /Nikki|Claude/);
    await page.click('#answer .errDetail summary');
    assert.equal(await page.isVisible('#answer .errDetail pre'), true);
    assert.equal(await nikki.busy(), false, 'die Insel bleibt nicht beschäftigt');
  });
});
