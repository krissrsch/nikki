import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanTranscript, parseVoice, pttKeys, VOICE_ASSETS, VOICE_KEY, webhookOk, whisperArgs } from './voice.js';

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

test('ohne Hey Nikki ist alles nur Text', () => {
  assert.deepEqual(parseVoice('Frag Claude, wie spät ist es?'), { kind: 'text', text: 'Frag Claude, wie spät ist es?' });
  assert.equal(parseVoice('Schreib an Team, hallo', ['Team']).kind, 'text');
  assert.equal(parseVoice('Nikki, frag Claude warum').kind, 'text');
  assert.deepEqual(parseVoice('Hey Nikki, wie geht es dir?'), { kind: 'text', text: 'wie geht es dir?' });
});

test('Claude: fragen und sagen, auch wenn Whisper den Namen anders schreibt', () => {
  assert.deepEqual(parseVoice('Hey Nikki, frag Claude, wie spät ist es?'), { kind: 'claude', text: 'wie spät ist es?' });
  assert.deepEqual(parseVoice('Hey Nikki! Sag Claude, dass er seine Arbeit gut macht.'), { kind: 'claude', text: 'dass er seine Arbeit gut macht.' });
  assert.deepEqual(parseVoice('Hey Nicky, frag Klord was ein Webhook ist'), { kind: 'claude', text: 'was ein Webhook ist' });
  assert.deepEqual(parseVoice('Hallo Niki. Sag mal Cloud: warum'), { kind: 'claude', text: 'warum' });
  assert.equal(parseVoice('Hey Nikki, frag Claude').kind, 'unclear', 'ohne Frage nichts abschicken');
  assert.equal(parseVoice('Hey Nikki, frag Clouds nach dem Wetter').kind, 'text');
});

test('Webhooks: ausführen und schreiben, nur Namen aus der Liste, der längste gewinnt', () => {
  const names = ['Team', 'Team Lounge'];
  assert.deepEqual(parseVoice('Hey Nikki, führe mal den Webhook Team aus mit Hallo zusammen', names), { kind: 'webhook', name: 'Team', text: 'Hallo zusammen' });
  assert.deepEqual(parseVoice('Hey Nikki, führ den Webhook Team Lounge aus: Essen ist fertig.', names), { kind: 'webhook', name: 'Team Lounge', text: 'Essen ist fertig.' });
  assert.deepEqual(parseVoice('Hey Nikki, starte Webhook Team mit Feierabend aus', names), { kind: 'webhook', name: 'Team', text: 'Feierabend' });
  assert.deepEqual(parseVoice('Hey Nikki, schreib an Team, ich komme gleich', names), { kind: 'webhook', name: 'Team', text: 'ich komme gleich' });
  assert.deepEqual(parseVoice('Hey Nikki, sag dem team dass ich später komme', names), { kind: 'webhook', name: 'Team', text: 'ich später komme' });
  assert.deepEqual(parseVoice('Hey Nikki, führe den Webhook Team aus', names), { kind: 'unclear', text: 'Was soll an Team?' });
  assert.equal(parseVoice('Hey Nikki, schreib an Teamleiter, hallo', names).kind, 'text', 'ein Hörfehler schickt nichts los');
  assert.equal(parseVoice('Hey Nikki, führe den Webhook Oma aus mit Hallo', names).kind, 'text');
});

test('Whisper bekommt die Namen als Hilfe', () => {
  const args = whisperArgs('m', 'w', ['Team']);
  assert.equal(args[args.indexOf('--prompt') + 1], 'Hey Nikki, Claude, Webhook, Team');
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
