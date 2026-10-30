import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { applyVoice, avatarUrl, createDiscord, discordPerson, encodeFrame, frameReader, pipePath } from './discord.js';

const alice = { user: { id: '1', username: 'alice', avatar: 'abc' }, nick: 'Ali', mute: false, voice_state: { self_mute: true, self_deaf: false } };
const bob = { user: { id: '2', username: 'bob', avatar: null }, voice_state: { self_deaf: true } };
const tick = () => new Promise((r) => setImmediate(r));

test('Rahmen: Stücke, mehrere in einem Block, kaputtes JSON bringt nichts zum Absturz', () => {
  const got = [];
  const read = frameReader((op, m) => got.push([op, m.a]));
  const a = encodeFrame(1, { a: 1 });
  const b = encodeFrame(3, { a: 2 });
  read(a.subarray(0, 3));
  read(Buffer.concat([a.subarray(3), b]));
  assert.deepEqual(got, [[1, 1], [3, 2]]);
  const bad = Buffer.alloc(9);
  bad.writeInt32LE(1, 0);
  bad.writeInt32LE(1, 4);
  bad[8] = 0x7b;
  read(bad);
  assert.equal(got.length, 2);
  assert.equal(pipePath(3), '\\\\?\\pipe\\discord-ipc-3');
});

test('Liste: beitreten, ändern, sprechen, gehen', () => {
  assert.deepEqual(discordPerson(alice), { id: '1', name: 'Ali', avatar: 'abc', muted: true, deaf: false, speaking: false });
  let list = applyVoice([], 'VOICE_STATE_CREATE', alice);
  list = applyVoice(list, 'VOICE_STATE_CREATE', bob);
  assert.equal(list[1].deaf, true);
  list = applyVoice(list, 'SPEAKING_START', { user_id: '1' });
  assert.equal(list[0].speaking, true);
  list = applyVoice(list, 'VOICE_STATE_UPDATE', { ...alice, voice_state: {} });
  assert.deepEqual([list.length, list[0].muted, list[0].speaking], [2, false, true], 'ein Update nimmt den Sprech-Ring nicht weg');
  list = applyVoice(list, 'VOICE_STATE_DELETE', bob);
  assert.deepEqual(list.map((p) => p.id), ['1']);
});

test('Avatar-Adresse nur aus echten IDs', () => {
  assert.equal(avatarUrl('123', 'a_b1'), 'https://cdn.discordapp.com/avatars/123/a_b1.png?size=64');
  assert.equal(avatarUrl('1/../x', 'abc'), null);
  assert.equal(avatarUrl('123', null), null);
});

// a stand-in for the running Discord client on the pipe
function fakeDiscord({ channel = null, closed = 0 } = {}) {
  const f = { sent: [], socks: [], connects: [], channel, reject: new Set(), timers: [] };
  const answer = (s, m, data, evt) => s.emit('data', encodeFrame(1, { cmd: m.cmd, nonce: m.nonce, data, evt }));
  f.event = (evt, data) => f.socks.at(-1).emit('data', encodeFrame(1, { cmd: 'DISPATCH', evt, data }));
  f.connect = (n) => {
    f.connects.push(n);
    const s = new EventEmitter();
    s.destroy = () => s.emit('close');
    const read = frameReader((op, m) => {
      f.sent.push(m);
      if (op === 0) return setImmediate(() => s.emit('data', encodeFrame(1, { cmd: 'DISPATCH', evt: 'READY', data: { user: { id: '1' } } })));
      if (f.reject.has(m.cmd)) return answer(s, m, { code: 4009, message: 'nein' }, 'ERROR');
      const data = m.cmd === 'GET_SELECTED_VOICE_CHANNEL' ? f.channel : ({ AUTHORIZE: { code: 'CODE' }, GET_GUILD: { name: 'Server' } }[m.cmd] ?? {});
      answer(s, m, data);
    });
    s.write = read;
    setImmediate(() => {
      if (n < closed) return s.emit('error', new Error('ENOENT'));
      f.socks.push(s);
      s.emit('connect');
    });
    return s;
  };
  return f;
}
const tokens = (start = null) => {
  const t = { value: start, get: () => t.value, exchange: async (c) => void (t.value = `tok-${c}`), refresh: async () => { throw new Error('abgelaufen'); }, clear: () => (t.value = null) };
  return t;
};
const run = async (fake, t, more = {}) => {
  const states = [];
  const client = createDiscord({ clientId: '42', connect: fake.connect, tokens: t, onState: (s) => states.push(s), wait: (fn) => (fake.timers.push(fn), fake.timers.length), stopWait: () => {}, ...more });
  for (let i = 0; i < 12; i++) await tick();
  return { client, states, last: () => states.at(-1) };
};

test('ohne Token: kein Dialog von selbst; erst der Knopf fragt in Discord, dann läuft der Kanal mit Liste', async () => {
  const fake = fakeDiscord({ channel: { id: '9', name: 'Lounge', guild_id: '7', voice_states: [alice, bob] } });
  const t = tokens();
  const { client, last } = await run(fake, t);
  assert.equal(last().status, 'auth');
  assert.ok(!fake.sent.some((m) => m.cmd === 'AUTHORIZE'));
  assert.deepEqual(fake.sent[0], { v: 1, client_id: '42' });
  await client.authorize();
  for (let i = 0; i < 12; i++) await tick();
  assert.equal(t.value, 'tok-CODE');
  assert.equal(last().status, 'live');
  assert.deepEqual(last().channel, { name: 'Lounge', guild: 'Server' });
  assert.deepEqual(last().people.map((p) => p.name), ['Ali', 'bob']);
  assert.equal(fake.sent.filter((m) => m.cmd === 'SUBSCRIBE' && m.args.channel_id === '9').length, 5);
  client.stop();
});

test('Token ungültig und nicht erneuerbar: wird gelöscht, Freigabe nötig', async () => {
  const fake = fakeDiscord();
  fake.reject.add('AUTHENTICATE');
  const t = tokens('alt');
  const { client, last } = await run(fake, t);
  assert.equal(last().status, 'auth');
  assert.equal(t.value, null);
  client.stop();
});

test('nicht im Kanal, dann Beitritt und wieder raus; nur andere lösen den Hinweis aus', async () => {
  const fake = fakeDiscord();
  const joins = [];
  const { client, last } = await run(fake, tokens('ok'), { onJoin: (n) => joins.push(n) });
  assert.equal(last().status, 'nochannel');
  fake.channel = { id: '9', name: 'Lounge', voice_states: [alice] };
  fake.event('VOICE_CHANNEL_SELECT', { channel_id: '9' });
  for (let i = 0; i < 12; i++) await tick();
  assert.equal(last().status, 'live');
  assert.equal(last().channel.guild, null);
  fake.event('VOICE_STATE_CREATE', alice);
  fake.event('VOICE_STATE_CREATE', bob);
  assert.deepEqual(joins, ['bob']);
  fake.channel = null;
  fake.event('VOICE_CHANNEL_SELECT', { channel_id: null });
  for (let i = 0; i < 12; i++) await tick();
  assert.equal(last().status, 'nochannel');
  assert.deepEqual(last().people, []);
  assert.equal(fake.sent.filter((m) => m.cmd === 'UNSUBSCRIBE').length, 5);
  client.stop();
});

test('Discord läuft nicht: alle Pipes probiert, ruhig neu versucht; Schließen zählt genauso', async () => {
  const fake = fakeDiscord({ closed: 10 });
  const { client, last } = await run(fake, tokens('ok'));
  assert.equal(last().status, 'nodiscord');
  assert.deepEqual(fake.connects, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.equal(fake.timers.length, 1);
  client.stop();

  const up = fakeDiscord();
  const live = await run(up, tokens('ok'));
  assert.equal(live.last().status, 'nochannel');
  up.socks.at(-1).destroy();
  assert.equal(live.last().status, 'nodiscord');
  assert.equal(up.timers.length, 1);
  up.timers[0]();
  for (let i = 0; i < 12; i++) await tick();
  assert.equal(live.last().status, 'nochannel');
  live.client.stop();
});
