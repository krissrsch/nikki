// English (setting "Sprache"): every tab of the island and every page of the settings, with all modules on, may show no
// German text or tooltip. User content (chat, to-dos, …) stays out of the check, as it stays out of the translation.
import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';
import { launch, until } from './nikki.js';

let nikki;
afterEach(async () => {
  await nikki?.close();
  nikki = null;
});

const GERMAN = /[äöüÄÖÜß]|\b(und|nicht|mit|der|das|ist|ein|eine|einen|für|von|auf|noch|alle|keine|wird|kann|oder|bei|zum|zur|dein|deine|dich|ohne|hier|jetzt|heute|Uhr|läuft|starten|öffnen|schließen|löschen|Ordner|Einstellungen)\b/;
// every visible-ish text: text nodes and the translated attributes, outside user content
const leftovers = (page) =>
  page.evaluate(() => {
    const keep = (el) => !!el?.closest?.(I18N_KEEP);
    const found = new Set();
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      if (n.nodeType === Node.TEXT_NODE) {
        if (!keep(n.parentElement) && !n.parentElement.closest('script, style') && n.data.trim()) found.add(n.data.trim());
      } else if (!keep(n)) for (const a of I18N_ATTRS) n.getAttribute(a)?.trim() && found.add(n.getAttribute(a).trim());
    }
    return [...found];
  });

describe('Sprache', () => {
  test('English: no German left on any tab or settings page', async () => {
    const ids = ['music', 'calendar', 'shelf', 'todo', 'notes', 'timer', 'clipboard', 'discord', 'notifications'];
    nikki = await launch({ state: { lang: 'en', modules: ids.map((id) => ({ id, on: true })) } });
    const { page } = nikki;
    assert.equal(await page.evaluate(() => document.documentElement.lang), 'en');
    const german = new Set();
    // quoted examples (“Hey Nikki, sag Claude …”) are German on purpose: voice commands are German in both languages
    const look = async (where, p) => (await leftovers(p)).filter((s) => GERMAN.test(s.replace(/“[^”]*”/g, ''))).forEach((s) => german.add(`${where}: ${s}`));

    for (const view of ['home', 'chat', ...ids]) {
      await page.click(`#tabs .tab[data-view="${view}"]`);
      await page.waitForTimeout(300);
      await look(view, page);
    }
    const s = await nikki.settings();
    for (const id of await s.$$eval('.sideBtn', (b) => b.map((x) => x.dataset.page))) {
      await s.click(`.sideBtn[data-page="${id}"]`);
      await s.waitForTimeout(200);
      await look(`settings/${id}`, s);
    }
    assert.deepEqual([...german], []);
    assert.deepEqual(nikki.errors, []);
  });

  test('Umschalten in den Einstellungen: Insel und Einstellungen laden neu in der neuen Sprache, die Wahl bleibt gespeichert', async () => {
    nikki = await launch();
    const { page } = nikki;
    assert.equal(await page.getAttribute('#tabs .tab[data-view="home"]', 'aria-label'), 'Heute');
    const s = await nikki.settings('general');
    await s.selectOption('#setLang', 'en');
    // both pages reload: a look during the reload finds no page and counts as "not yet"
    const homeTab = () => page.evaluate(() => document.querySelector('#tabs .tab[data-view="home"]')?.getAttribute('aria-label')).catch(() => null);
    await until(async () => (await homeTab()) === 'Today', 'Insel auf Englisch');
    await until(() => s.evaluate(() => document.querySelector('.sideBtn[data-page="general"]')?.textContent.trim() === 'General').catch(() => false), 'Einstellungen auf Englisch');
    assert.equal(nikki.state().lang, 'en');
    await s.selectOption('#setLang', 'de');
    await until(async () => (await homeTab()) === 'Heute', 'wieder Deutsch');
    assert.deepEqual(nikki.errors, []);
  });
});
