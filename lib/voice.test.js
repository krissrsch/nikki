import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanTranscript, parseVoice, pttKeys, VOICE_ASSETS, VOICE_KEY, webhookOk } from './voice.js';

test('Taste: Kombination wird zu Windows-Tastencodes, Unbekanntes wird abgelehnt', () => {
  assert.deepEqual(pttKeys(VOICE_KEY), [0x11, 0x12, 0x56]);
  assert.deepEqual(pttKeys('F9'), [120]);
  assert.deepEqual(pttKeys('Super+Shift+Space'), [0x5b, 0x10, 32]);
  assert.deepEqual(pttKeys('Control+num5'), [0x11, 101]);
  assert.equal(pttKeys('Control+Quark'), null);
  assert.equal(pttKeys(''), null);
});

test('Whisper-Text: Notizen sind keine Sprache', () => {
  assert.equal(cleanTranscript(' Hallo Welt.\n Noch ein Satz.\n'), 'Hallo Welt. Noch ein Satz.');
  assert.equal(cleanTranscript('[BLANK_AUDIO]\n(Musik)\n*Stille*'), '');
});

test('frag Claude: mit und ohne Anrede, auch wenn Whisper den Namen anders schreibt', () => {
  assert.deepEqual(parseVoice('Frag Claude, wie spät ist es?'), { kind: 'claude', text: 'wie spät ist es?' });
  assert.deepEqual(parseVoice('Hey Nikki, frag Claude was ein Webhook ist'), { kind: 'claude', text: 'was ein Webhook ist' });
  assert.deepEqual(parseVoice('frage Cloud: warum'), { kind: 'claude', text: 'warum' });
  assert.equal(parseVoice('Frag Claude').kind, 'text', 'ohne Frage nichts abschicken');
  assert.equal(parseVoice('Frag Clouds nach dem Wetter').kind, 'text');
});

test('schreib an: nur Namen aus der Liste; der längste passende gewinnt; sonst bleibt es Text', () => {
  const names = ['Team', 'Team Lounge'];
  assert.deepEqual(parseVoice('Schreib an Team, ich komme gleich', names), { kind: 'webhook', name: 'Team', text: 'ich komme gleich' });
  assert.deepEqual(parseVoice('Sag dem team dass ich später komme', names), { kind: 'webhook', name: 'Team', text: 'ich später komme' });
  assert.deepEqual(parseVoice('Hey Nikki, schick in Team Lounge: Hallo', names), { kind: 'webhook', name: 'Team Lounge', text: 'Hallo' });
  assert.equal(parseVoice('Schreib an Teamleiter, hallo', names).kind, 'text', 'ein Hörfehler schickt nichts los');
  assert.equal(parseVoice('Schreib an Oma, hallo', names).kind, 'text');
  assert.equal(parseVoice('Schreib an Team', names).kind, 'text', 'ohne Nachricht nichts senden');
  assert.deepEqual(parseVoice('Ein ganz normaler Satz.'), { kind: 'text', text: 'Ein ganz normaler Satz.' });
});

test('Webhook-Adressen: nur Discord, nur der Webhook-Pfad', () => {
  assert.equal(webhookOk('https://discord.com/api/webhooks/123/abc-DEF_1'), true);
  assert.equal(webhookOk('http://discord.com/api/webhooks/123/abc'), false);
  assert.equal(webhookOk('https://discord.com.evil.io/api/webhooks/123/abc'), false);
  assert.equal(webhookOk('https://discord.com/api/users/123'), false);
  assert.equal(webhookOk('kein link'), false);
});

test('Downloads sind festgenagelt: HTTPS, mit Hash und Größe', () => {
  for (const a of VOICE_ASSETS) {
    assert.match(a.url, /^https:\/\//);
    assert.match(a.sha256, /^[0-9a-f]{64}$/);
    assert.ok(a.size > 0);
  }
});
