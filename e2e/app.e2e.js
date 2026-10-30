// Offline e2e run: no network, no Claude login. Claude is replaced at the IPC boundary where a test needs a running task.
import assert from 'node:assert/strict';
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
    // the empty strip of the tab bar closes it (the spacer itself has no height to click)
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
});
