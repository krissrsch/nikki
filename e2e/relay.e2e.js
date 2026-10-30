// Terminal relay, offline: a Claude Code session in a terminal is played through the real hook.cjs, answered in the island.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';
import { launch, root, until } from './nikki.js';

const SESSION = { session_id: 'term-1', cwd: 'C:/proj/demo' };
const permission = { ...SESSION, hook_event_name: 'PermissionRequest', tool_name: 'Bash', tool_input: { command: 'npm test' }, permission_suggestions: [{ type: 'addRules' }] };
const stopEvent = { ...SESSION, hook_event_name: 'Stop' };

describe('Terminal-Rückkanal', () => {
  let nikki;
  let page;
  // runs hook.cjs as Claude Code would: event on stdin, decision on stdout
  const hook = (event, ...flags) =>
    new Promise((resolve) => {
      const p = spawn(process.execPath, [path.join(root, 'hook.cjs'), path.join(nikki.userData, 'hook.json'), ...flags, '--nikki-hook'], {
        env: { ...process.env, DESKTOPCOMPANION_AGENT: '' }, // set means "own SDK session" and the hook stays out
      });
      let out = '';
      p.stdout.on('data', (d) => (out += d));
      p.on('exit', (code) => resolve({ code, out }));
      p.stdin.end(JSON.stringify(event));
    });
  const settings = () => JSON.parse(fs.readFileSync(path.join(nikki.home, '.claude', 'settings.json'), 'utf8'));
  const permissionHook = () => (settings().hooks?.PermissionRequest ?? []).flatMap((g) => g.hooks).find((h) => h.command.includes('--nikki-hook'));

  before(async () => {
    // hooks and relay on, and our hook already in the settings: the start refreshes it to the relay form
    nikki = await launch({
      state: { hooks: true, relay: true },
      settings: { hooks: { SessionStart: [{ hooks: [{ type: 'command', command: 'x --nikki-hook', async: true }] }] } },
    });
    page = nikki.page;
    await until(() => fs.existsSync(path.join(nikki.userData, 'hook.json')), 'hook.json');
  });
  after(() => nikki?.close());

  test('Start schreibt einen wartenden PermissionRequest-Hook', async () => {
    const h = await until(permissionHook, 'PermissionRequest-Hook');
    assert.match(h.command, /--wait/);
    assert.equal(h.timeout, 120);
    assert.equal(h.async, undefined);
  });

  test('Freigabe aus dem Terminal: „Immer“ in der Insel', async () => {
    const answered = hook(permission, '--wait');
    await page.waitForSelector('#permission:not([hidden])');
    assert.equal(await page.textContent('#permTitle'), 'demo · Terminal: Bash ausführen?');
    await page.click('#permActions button:has-text("Immer")');
    const { code, out } = await answered;
    assert.equal(code, 0);
    assert.deepEqual(JSON.parse(out), {
      hookSpecificOutput: { hookEventName: 'PermissionRequest', decision: { behavior: 'allow', updatedPermissions: [{ type: 'addRules' }] } },
    });
  });

  test('Im Terminal beantwortet: Stop räumt die Karte ab, der Hook bleibt still', async () => {
    const waiting = hook(permission, '--wait');
    await page.waitForSelector('#permission:not([hidden])');
    await hook(stopEvent);
    const { code, out } = await waiting;
    assert.equal(code, 0);
    assert.equal(out, '');
    await page.waitForSelector('#permission', { state: 'hidden' });
  });

  test('Vorgemerkte Nachricht geht mit dem Stop-Hook an Claude, einmal', async () => {
    await hook({ ...SESSION, hook_event_name: 'PreToolUse', tool_name: 'Read', tool_input: { file_path: 'a.js' } });
    assert.equal(await page.evaluate(() => window.companion.queueMessage('term-1', 'Bitte noch Tests schreiben')), true);
    const first = await hook(stopEvent, '--stop');
    const reply = JSON.parse(first.out);
    assert.equal(reply.decision, 'block');
    assert.match(reply.reason, /Bitte noch Tests schreiben/);
    assert.equal((await hook(stopEvent, '--stop')).out, '');
  });
});
