// Runs against the real, logged-in Claude Code (Haiku, short prompts). Only with NIKKI_E2E_CLAUDE=1; skipped otherwise.
// Nikki still gets a temp userData and a temp project; the home stays real because Claude needs its login there.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';
import { launch, rm, tmpDir, until } from './nikki.js';

const TURN = 120000;
// Claude Code keeps the transcripts of a folder in ~/.claude/projects/<path with every non-alphanumeric as ->
const transcripts = (dir) => path.join(os.homedir(), '.claude', 'projects', dir.replace(/[^a-zA-Z0-9]/g, '-'));

describe('Nikki mit Claude', { skip: process.env.NIKKI_E2E_CLAUDE !== '1' && 'nur mit NIKKI_E2E_CLAUDE=1 (echtes Claude, Login nötig)' }, () => {
  let nikki;
  let page;
  let proj;
  before(async () => {
    proj = tmpDir('claude');
    nikki = await launch({ realHome: true, state: { projects: [proj], models: { [proj]: { claude: 'haiku' } } } });
    page = nikki.page;
    await nikki.openChat();
  });
  after(async () => {
    await nikki?.close();
    rm(proj);
    rm(transcripts(proj));
  });

  const answers = () => page.locator('#thread .msg-assistant').allTextContents();
  const idle = async () => !(await nikki.busy());
  // sends a prompt and waits for the turn to end; onCard answers each permission card on the way
  async function turn(text, onCard) {
    const n = (await answers()).length;
    await nikki.send(text);
    await until(nikki.busy, 'Aufgabe läuft');
    await until(
      async () => {
        if (onCard && (await page.isVisible('#permission'))) await onCard();
        return idle();
      },
      'Aufgabe fertig',
      TURN,
    );
    const all = await answers();
    return all.length > n ? all.at(-1) : null;
  }

  test('Prompt bekommt eine Antwort', { timeout: TURN }, async () => {
    assert.match((await turn('Antworte nur mit dem Wort: Pong')) ?? '', /pong/i);
    assert.equal(await page.isVisible('#answer.error'), false);
  });

  test('B4: Senden direkt nach „fertig“ startet ohne Fehler', { timeout: 2 * TURN }, async () => {
    const n = (await answers()).length;
    await nikki.send('Antworte nur mit dem Wort: Eins');
    await page.waitForFunction((n) => document.querySelectorAll('#thread .msg-assistant').length > n, n, { timeout: TURN });
    await nikki.send('Antworte nur mit dem Wort: Zwei'); // the old CLI is still exiting now
    const outcome = await page.waitForFunction(
      (n) => {
        const err = document.getElementById('answer');
        if (err.classList.contains('error') && !err.hidden) return `Fehler: ${err.textContent}`;
        return document.querySelectorAll('#thread .msg-assistant').length > n + 1 && 'ok';
      },
      n,
      { timeout: TURN },
    );
    assert.equal(await outcome.jsonValue(), 'ok');
    assert.match((await answers()).at(-1), /zwei/i);
  });

  test('Freigabe: Erlauben führt den Befehl aus', { timeout: TURN }, async () => {
    let cards = 0;
    const last = await turn('Führe mit dem Bash-Tool genau diesen Befehl aus: node -e "console.log(6*7)". Antworte danach nur mit der Ausgabe.', async () => {
      cards++;
      assert.match(await page.textContent('#permTitle'), /bash/i);
      await page.click('#permActions button:has-text("Erlauben")');
    });
    assert.ok(cards >= 1, 'keine Freigabe-Karte');
    assert.match(last ?? '', /42/);
  });

  test('Freigabe: Ablehnen führt nichts aus', { timeout: TURN }, async () => {
    let cards = 0;
    await turn('Führe mit dem Bash-Tool genau diesen Befehl aus: git init. Wird er abgelehnt, versuch nichts anderes.', async () => {
      cards++;
      await page.click('#permActions button:has-text("Ablehnen")');
    });
    assert.ok(cards >= 1, 'keine Freigabe-Karte');
    assert.equal(fs.existsSync(path.join(proj, '.git')), false);
  });

  test('B5: Stop schreibt keinen Diagnose-Text in den Chat', { timeout: TURN }, async () => {
    await nikki.send('Schreib einen Aufsatz mit 1500 Wörtern über Katzen.');
    await until(nikki.busy, 'Aufgabe läuft');
    await page.waitForTimeout(3000);
    await page.click('#go');
    await until(idle, 'gestoppt', 15000);
    assert.equal(await page.textContent('#stepLine'), 'Nikki stoppte.');
    await page.waitForTimeout(1000); // a late error result must not land either
    const shown = `${await page.textContent('#thread')}\n${await page.textContent('#answer')}`;
    const saved = JSON.stringify(nikki.state().chats);
    for (const text of [shown, saved]) assert.doesNotMatch(text, /ede_diagnostic|result_type|stop_reason/);
  });
});
