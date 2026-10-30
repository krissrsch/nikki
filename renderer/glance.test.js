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
const music = { playing: true };

test('idle: no glow, awake, asleep after N minutes, hover wakes', () => {
  assert.deepEqual(glance({ now: NOW, lastActivity: NOW - 4 * MIN }), { mood: 'awake', glow: null });
  assert.equal(glance({ now: NOW, lastActivity: NOW - 5 * MIN }).mood, 'sleep');
  assert.equal(glance({ now: NOW, lastActivity: NOW - 5 * MIN, hover: true }).mood, 'awake');
  assert.equal(glance({ now: NOW, lastActivity: NOW - 9 * MIN, sleepMin: 10 }).mood, 'awake');
  assert.equal(glance({ now: NOW, lastActivity: NOW - 2 * MIN, sleepMin: 1 }).mood, 'sleep');
});

test('only eyes and glow: no infos beside the eyes, whatever happens', () => {
  for (const status of ['needsYou', 'working', 'done', 'error', 'idle']) {
    assert.deepEqual(Object.keys(glance({ status, music, sound: true, now: NOW })).sort(), ['glow', 'mood'], status);
  }
});

test('agent: needs you, working and thinking, done, error each have their edge', () => {
  assert.deepEqual(glance({ status: 'needsYou', now: NOW }), { mood: 'need', glow: 'need' });
  assert.deepEqual(glance({ status: 'working', now: NOW }), { mood: 'work', glow: 'work' });
  assert.deepEqual(glance({ status: 'thinking', now: NOW }), { mood: 'work', glow: 'work' });
  assert.deepEqual(glance({ status: 'done', now: NOW }), { mood: 'done', glow: 'done' });
  assert.deepEqual(glance({ status: 'error', now: NOW }), { mood: 'awake', glow: 'error' });
});

test('music or any system sound: dancing eyes and the music edge; paused is idle', () => {
  assert.deepEqual(glance({ music, now: NOW }), { mood: 'music', glow: 'music' });
  assert.deepEqual(glance({ sound: true, now: NOW }), { mood: 'music', glow: 'music' });
  assert.equal(glance({ music: { playing: false }, now: NOW }).glow, null);
});

test('rank: voice > needs you > agent > music', () => {
  assert.equal(glance({ status: 'needsYou', voice: true, music, now: NOW }).glow, 'voice');
  assert.equal(glance({ status: 'needsYou', music, now: NOW }).glow, 'need');
  assert.deepEqual(glance({ status: 'working', voice: true, music, now: NOW }), { mood: 'awake', glow: 'voice' });
  assert.equal(glance({ status: 'working', music, sound: true, now: NOW }).glow, 'work');
  assert.equal(glance({ status: 'done', music, now: NOW }).mood, 'done');
  assert.equal(glance({ status: 'error', sound: true, now: NOW }).glow, 'error');
});

test('fertig blitzt nur kurz: danach zeigt die Kante wieder die Musik', () => {
  assert.equal(glance({ status: 'done', music, doneAge: 3999, now: NOW }).glow, 'done');
  assert.deepEqual(glance({ status: 'done', music, doneAge: 4000, now: NOW }), { mood: 'music', glow: 'music' });
  assert.equal(glance({ status: 'done', sound: true, doneAge: 9000, now: NOW }).glow, 'music');
  assert.equal(glance({ status: 'done', doneAge: 9000, now: NOW }).glow, null);
});

test('chat dot: needs you > error > done', () => {
  assert.equal(chatDot({}), null);
  assert.equal(chatDot({ needsYou: true, unseen: 'error', terminalDone: true }), 'warn');
  assert.equal(chatDot({ unseen: 'error', terminalDone: true }), 'bad');
  assert.equal(chatDot({ unseen: 'done' }), 'accent');
  assert.equal(chatDot({ terminalDone: true }), 'accent');
});
