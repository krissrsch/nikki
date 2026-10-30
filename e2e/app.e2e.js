// Offline e2e run: no network, no Claude login. Claude is replaced at the IPC boundary where a test needs a running task.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, test } from 'node:test';
import { launch, rm, tmpDir, until } from './nikki.js';

let nikki;
const dirs = [];
const project = (name) => {
  const d = tmpDir(name);
  dirs.push(d);
  return d;
};
afterEach(async () => {
  await nikki?.close();
  nikki = null;
  dirs.splice(0).forEach(rm);
});
const item = (dir) => `#projectMenu button:has-text("${path.basename(dir)}")`;
const isOpen = () => nikki.page.evaluate(() => document.getElementById('island').classList.contains('open'));

describe('Nikki offline', () => {
  test('Kaltstart ohne Konsolenfehler, Daten nur im Temp-Ordner', async () => {
    nikki = await launch();
    const where = await nikki.app.evaluate(({ app }) => ({ userData: app.getPath('userData'), home: process.getBuiltinModule('node:os').homedir() }));
    assert.equal(where.userData, nikki.userData);
    assert.equal(where.home, nikki.home);
    await nikki.page.waitForTimeout(1500); // late errors from the first ticks after the intro
    assert.deepEqual(nikki.errors, []);
    assert.equal(await nikki.page.textContent('#projectName'), 'Projekt wählen');
  });

  test('Insel öffnet und schließt', async () => {
    nikki = await launch();
    assert.equal(await isOpen(), true, 'nach dem Start ist die Insel offen');
    await nikki.page.keyboard.press('Escape');
    assert.equal(await isOpen(), false);
    await nikki.page.click('#notch');
    assert.equal(await isOpen(), true);
    assert.equal(await nikki.page.getAttribute('#notch', 'aria-expanded'), 'true');
    // the empty strip of the tab bar closes it (the spacer itself has no height to click);
    // measured once the island has its full width: with module tabs the spacer's middle is off-center
    await nikki.page.waitForFunction(() => document.getElementById('island').getBoundingClientRect().width === 720);
    const bar = await nikki.page.locator('#tabs').boundingBox();
    const gap = await nikki.page.locator('#tabs .grow').boundingBox();
    await nikki.page.mouse.click(gap.x + gap.width / 2, bar.y + bar.height / 2);
    assert.equal(await isOpen(), false);
  });

  test('Projekt wählen und wechseln', async () => {
    const a = project('projA');
    const b = project('projB');
    nikki = await launch();
    const { page } = nikki;
    await nikki.openChat();
    for (const dir of [a, b]) {
      await nikki.pickFolderReturns(dir);
      await page.click('#projectBtn');
      await page.click('#projectMenu button:has-text("Ordner wählen…")');
      await page.waitForFunction((name) => document.getElementById('projectName').textContent === name, path.basename(dir));
    }
    assert.deepEqual(nikki.state().projects, [b, a], 'der neue Ordner steht oben');
    await page.click('#projectBtn');
    assert.equal(await page.getAttribute(item(b), 'aria-checked'), 'true');
    await page.click(item(a));
    assert.equal(await page.textContent('#projectName'), path.basename(a));
    assert.equal(await page.isHidden('#projectMenu'), true);
  });

  test('B1: Code, Inline-Code und Links bleiben im Chat unverfälscht', async () => {
    const a = project('projA');
    const code = 'console.log(fs.readFileSync("a.txt"));\nconst n = user.profile.name;';
    const text = `Hier ist der Code:\n\n\`\`\`js\n${code}\n\`\`\`\n\nDie Datei \`config.json\` steht unter https://example.com/docs bereit.`;
    nikki = await launch({
      state: {
        projects: [a],
        chats: [{ id: 'chat-md', cwd: a, backend: 'claude', sessionId: null, title: 'Markdown', updatedAt: 2, messages: [{ role: 'user', text: 'Zeig Code', at: 1 }, { role: 'assistant', text, at: 2 }] }],
        lastChatId: 'chat-md',
      },
    });
    await nikki.openChat();
    const out = await nikki.page.evaluate(() => {
      const msg = document.querySelector('#thread .msg-assistant');
      const link = msg?.querySelector('a');
      return {
        block: msg?.querySelector('pre code')?.textContent,
        inline: [...(msg?.querySelectorAll(':not(pre) > code') ?? [])].map((c) => c.textContent),
        href: link?.getAttribute('href'),
        linkText: link?.textContent,
      };
    });
    assert.equal(out.block?.trimEnd(), code);
    assert.deepEqual(out.inline, ['config.json']);
    assert.equal(out.href, 'https://example.com/docs');
    assert.equal(out.linkText, 'https://example.com/docs');
  });

  test('B2: Projektwechsel nimmt keine fremde Session mit, der alte Chat bleibt unverändert', async () => {
    const a = project('projA');
    const b = project('projB');
    const chatA = { id: 'chat-a', cwd: a, backend: 'claude', sessionId: 'sess-A', title: 'Chat in A', updatedAt: 2, messages: [{ role: 'user', text: 'Hallo A', at: 1 }, { role: 'assistant', text: 'Hi aus A', at: 2 }] };
    nikki = await launch({ state: { projects: [a, b], chats: [chatA], lastChatId: 'chat-a' } });
    const { page } = nikki;
    await nikki.fakeClaude();
    await nikki.openChat();
    await page.click('#projectBtn');
    await page.click(item(b));
    await nikki.send('Hallo B');
    const { starts } = await until(nikki.calls, 'start');
    assert.equal(starts.length, 1);
    assert.equal(starts[0].cwd, b);
    assert.ok(!JSON.stringify(starts[0]).includes('sess-A'), `fremde Session im Start: ${JSON.stringify(starts[0])}`);
    await nikki.status({ state: 'done', text: 'Nikki ist fertig.', answer: 'Antwort aus B' });
    await page.waitForSelector('#thread .msg-assistant:has-text("Antwort aus B")');
    const chats = await until(() => (nikki.state().chats?.length === 2 ? nikki.state().chats : null), 'zweiter Chat gespeichert');
    const savedA = chats.find((c) => c.id === 'chat-a');
    assert.equal(savedA.cwd, a);
    assert.equal(savedA.sessionId, 'sess-A');
    assert.deepEqual(savedA.messages.map((m) => m.text), ['Hallo A', 'Hi aus A']);
    assert.equal(chats.find((c) => c.id !== 'chat-a').cwd, b);
  });

  test('Module: ein und aus ohne Neustart, Daten in userData/modules, „An Chat“ schickt nichts', async () => {
    nikki = await launch();
    const { page } = nikki;
    const tabs = () => page.$$eval('#moduleTabs .tab', (b) => b.map((x) => x.dataset.view));
    assert.deepEqual(await tabs(), ['music', 'calendar', 'shelf', 'todo', 'notes', 'timer']);
    assert.equal(await page.locator('#homeTiles .tile').count(), 4, 'Claude, Musik, Wetter, Kalender');
    await page.click('#tabs .tab[data-view="settings"]');
    await page.click('#mod-calendar');
    await page.waitForFunction(() => !document.querySelector('#moduleTabs .tab[data-view="calendar"]'));
    assert.equal(await page.locator('#homeTiles .tile').count(), 3, 'its tile goes with it');
    assert.deepEqual(nikki.state().modules.find((m) => m.id === 'calendar'), { id: 'calendar', on: false });
    await page.click('#mod-calendar');
    await page.waitForSelector('#moduleTabs .tab[data-view="calendar"]');
    assert.equal(await page.locator('#homeTiles .tile').count(), 4);

    await nikki.fakeClaude();
    await page.click('#tabs .tab[data-view="todo"]');
    await page.fill('.todoNew', 'Milch holen');
    await page.press('.todoNew', 'Enter');
    const file = path.join(nikki.userData, 'modules', 'todo.json');
    const saved = await until(() => fs.existsSync(file) && JSON.parse(fs.readFileSync(file, 'utf8')), 'todo.json geschrieben');
    assert.equal(saved.items[0].text, 'Milch holen');
    await page.click('.todoRow .todoChat');
    assert.equal(await page.inputValue('#prompt'), 'Milch holen');
    assert.equal(await page.getAttribute('#tabs .tab[data-view="chat"]', 'aria-pressed'), 'true');
    assert.deepEqual((await nikki.calls()).starts, [], 'nicht abgeschickt');
    assert.deepEqual(nikki.errors, []);
  });

  test('B6: Enter im leeren Feld stoppt nichts, auch nicht bei offener Freigabe', async () => {
    const a = project('projA');
    nikki = await launch({ state: { projects: [a] } });
    const { page } = nikki;
    await nikki.fakeClaude();
    await nikki.openChat();
    await nikki.send('Lauf los');
    await until(nikki.busy, 'Aufgabe läuft');
    await page.press('#prompt', 'Enter');
    await nikki.permission({ id: 9001, toolName: 'Bash', input: { command: 'echo hi' } });
    await page.waitForSelector('#permission:not([hidden])');
    await page.focus('#prompt');
    await page.press('#prompt', 'Enter');
    await page.waitForTimeout(300); // stop is a fire-and-forget IPC
    assert.equal((await nikki.calls()).stops, 0, 'Enter hat die Aufgabe gestoppt');
    assert.equal(await nikki.busy(), true);
    assert.equal(await page.isDisabled('#go'), true, 'Stop ist gesperrt, solange die Karte wartet');
    await page.click('#permActions button:has-text("Erlauben")');
    await page.click('#go'); // the stop button still stops
    await until(async () => (await nikki.calls()).stops === 1, 'Stop-Knopf stoppt');
  });

  test('Karten-Hotkeys: A erlaubt, D lehnt ab, Ziffer wählt; der Composer kapert nichts, Esc schließt nicht', async () => {
    const a = project('projA');
    nikki = await launch({ state: { projects: [a] } });
    const { page, app } = nikki;
    await nikki.fakeClaude();
    await app.evaluate(({ ipcMain }) => {
      globalThis.answers = [];
      ipcMain.on('permission-answer', (_e, x) => globalThis.answers.push(x));
    });
    const answers = () => app.evaluate(() => globalThis.answers);
    await nikki.openChat();
    await nikki.send('Lauf los');
    await until(nikki.busy, 'Aufgabe läuft');
    const card = async (r) => {
      await nikki.permission(r);
      await page.waitForSelector('#permission:not([hidden])');
      await page.waitForTimeout(600); // keys only count a moment after the card appeared
    };

    await card({ id: 1, toolName: 'Bash', input: { command: 'npm test' } });
    assert.deepEqual(await page.$$eval('#permActions kbd', (k) => k.map((x) => x.textContent)), ['A', 'I', 'D']);
    assert.equal(await page.getAttribute('#permActions .primary', 'aria-keyshortcuts'), 'A Enter');
    await page.keyboard.press('a');
    await card({ id: 2, toolName: 'Bash', input: { command: 'rm -rf build' } });
    await page.keyboard.press('d');
    await card({ id: 3, toolName: 'AskUserQuestion', input: { questions: [{ question: 'Tee oder Kaffee?', options: [{ label: 'Tee' }, { label: 'Kaffee' }] }] } });
    assert.deepEqual(await page.$$eval('#permBody .opt kbd', (k) => k.map((x) => x.textContent)), ['1', '2']);
    await page.keyboard.press('2');
    await until(async () => (await answers()).length === 3, 'drei Antworten');
    assert.deepEqual(await answers(), [
      { id: 1, answer: 'allow' },
      { id: 2, answer: 'deny' },
      { id: 3, answer: 'allow', picks: [['Kaffee']] },
    ]);

    // in the composer the keys stay text, Enter sends nothing and stops nothing (B6); Esc leaves the island open
    await card({ id: 4, toolName: 'Bash', input: { command: 'echo hi' } });
    await page.focus('#prompt');
    await page.keyboard.press('a');
    await page.keyboard.press('Backspace');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    assert.equal((await answers()).length, 3, 'der Composer hat die Karte beantwortet');
    assert.equal((await nikki.calls()).stops, 0, 'Enter hat die Aufgabe gestoppt');
    assert.equal(await isOpen(), true, 'Esc hat die Insel geschlossen');
    await page.click('#permTitle'); // back on the card: Enter allows
    await page.keyboard.press('Enter');
    await until(async () => (await answers()).length === 4, 'Enter erlaubt');
    assert.deepEqual((await answers())[3], { id: 4, answer: 'allow' });
    assert.equal(await page.evaluate(() => document.activeElement.id), 'prompt', 'danach zurück im Composer');
    assert.deepEqual(nikki.errors, []);
  });
});
