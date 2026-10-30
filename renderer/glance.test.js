import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// classic renderer script: run it in a sandbox and take its globals
const src = readFileSync(new URL('./glance.js', import.meta.url), 'utf8');
const ctx = vm.runInNewContext(`${src}\n({ glance, chatDot })`);
// objects from the sandbox have another Object.prototype: compare plain copies
const glance = (input) => JSON.parse(JSON.stringify(ctx.glance(input)));
const chatDot = (input) => ctx.chatDot(input);

const NOW = 1_800_000_000_000;
const MIN = 60 * 1000;
const music = { title: 'Songtitel', cover: 'data:x', playing: true };
const event = { title: 'Daily', at: NOW + 12 * MIN };

test('idle: narrow, awake, asleep after N minutes, hover wakes', () => {
  assert.deepEqual(glance({ now: NOW, lastActivity: NOW - 4 * MIN }), { mood: 'awake', wide: false, left: null, right: null });
  assert.equal(glance({ now: NOW, lastActivity: NOW - 5 * MIN }).mood, 'sleep');
  assert.equal(glance({ now: NOW, lastActivity: NOW - 5 * MIN, hover: true }).mood, 'awake');
  assert.equal(glance({ now: NOW, lastActivity: NOW - 9 * MIN, sleepMin: 10 }).mood, 'awake');
  assert.equal(glance({ now: NOW, lastActivity: NOW - 2 * MIN, sleepMin: 1 }).mood, 'sleep');
});

test('needs you: wide, warn text left, project right, need eyes', () => {
  assert.deepEqual(glance({ status: 'needsYou', text: 'npm test?', project: 'notch-nikki', now: NOW }), {
    mood: 'need',
    wide: true,
    left: { icon: 'dot', text: 'npm test?', tone: 'warn' },
    right: { text: 'notch-nikki', tone: 'muted' },
  });
});

test('agent: working and thinking look, done hops, error stumbles', () => {
  const work = glance({ status: 'working', project: 'p', now: NOW });
  assert.equal(work.mood, 'work');
  assert.deepEqual(work.left, { icon: 'spin', text: 'arbeitet', tone: 'accent' });
  assert.equal(glance({ status: 'thinking', now: NOW }).mood, 'work');
  const done = glance({ status: 'done', project: 'p', now: NOW });
  assert.equal(done.mood, 'done');
  assert.deepEqual(done.left, { icon: 'check', text: 'fertig', tone: 'accent' });
  assert.equal(glance({ status: 'error', now: NOW }).left.tone, 'bad');
  assert.equal(glance({ status: 'working', now: NOW }).right, null, 'no project, no right info');
});

test('appointment only within 15 minutes', () => {
  const g = glance({ event, now: NOW });
  assert.equal(g.mood, 'awake');
  assert.deepEqual(g.left, { icon: 'calendar', text: 'Daily' });
  assert.deepEqual(g.right, { text: 'in 12 min', tone: 'warn' });
  assert.equal(glance({ event: { title: 'x', at: NOW + 15 * MIN }, now: NOW }).wide, false);
  assert.equal(glance({ event: { title: 'x', at: NOW - 1 }, now: NOW }).wide, false, 'started already');
  assert.equal(glance({ event: { title: 'x', at: NOW }, now: NOW }).right.text, 'jetzt');
});

test('music: cover and title left, visualizer right, eyes dance; paused shows nothing', () => {
  const g = glance({ music, now: NOW });
  assert.equal(g.mood, 'music');
  assert.deepEqual(g.left, { icon: 'cover', cover: 'data:x', text: 'Songtitel' });
  assert.deepEqual(g.right, { icon: 'viz' });
  assert.equal(glance({ music: { ...music, playing: false }, now: NOW }).wide, false);
});

test('peek lasts until its time, then the next item shows', () => {
  const peek = { icon: 'volume', text: '60 %', right: { icon: 'level', level: 0.6 }, until: NOW + 2000 };
  const g = glance({ peek, music, now: NOW });
  assert.equal(g.mood, 'awake');
  assert.deepEqual(g.left, { icon: 'volume', text: '60 %' });
  assert.deepEqual(g.right, { icon: 'level', level: 0.6 }, 'its bar, not the song');
  assert.deepEqual(glance({ peek: { ...peek, right: undefined }, music, now: NOW }).right, { icon: 'music', cover: 'data:x' }, 'without a right side the next item fills it');
  assert.equal(glance({ peek, music, now: NOW + 2000 }).mood, 'music');
});

test('rank: the highest item sets the eyes and the left side, the next one takes the right', () => {
  const both = glance({ status: 'working', project: 'p', music, now: NOW });
  assert.equal(both.mood, 'work');
  assert.equal(both.left.text, 'arbeitet');
  assert.deepEqual(both.right, { icon: 'music', cover: 'data:x' });
  assert.equal(glance({ status: 'done', event, music, now: NOW }).right.icon, 'calendar');
  assert.equal(glance({ event, music, now: NOW }).mood, 'awake', 'appointment beats music');
  // needs you keeps the project: which session asks matters more than the song
  const need = glance({ status: 'needsYou', text: 'Nikki will OK!', project: 'p', music, event, now: NOW });
  assert.equal(need.mood, 'need');
  assert.deepEqual(need.right, { text: 'p', tone: 'muted' });
});

test('timer: countdown on the right, between appointment and music', () => {
  const timer = { label: 'Fokus', text: '18:31' };
  const g = glance({ timer, now: NOW });
  assert.equal(g.mood, 'awake');
  assert.deepEqual(g.left, { icon: 'timer', text: 'Fokus' });
  assert.deepEqual(g.right, { text: '18:31' });
  assert.deepEqual(glance({ timer, music, now: NOW }).right, { text: '18:31' }, 'beats music and keeps its countdown');
  assert.equal(glance({ event, timer, now: NOW }).left.icon, 'calendar', 'appointment beats timer');
  assert.deepEqual(glance({ event, timer, now: NOW }).right, { icon: 'timer', text: '18:31' }, 'countdown still on the right');
  assert.deepEqual(glance({ status: 'working', project: 'p', timer, now: NOW }).right, { icon: 'timer', text: '18:31' });
  assert.deepEqual(glance({ status: 'needsYou', project: 'p', timer, now: NOW }).right, { text: 'p', tone: 'muted' });
});

test('chat dot: needs you > error > done', () => {
  assert.equal(chatDot({}), null);
  assert.equal(chatDot({ needsYou: true, unseen: 'error', terminalDone: true }), 'warn');
  assert.equal(chatDot({ unseen: 'error', terminalDone: true }), 'bad');
  assert.equal(chatDot({ unseen: 'done' }), 'accent');
  assert.equal(chatDot({ terminalDone: true }), 'accent');
});
