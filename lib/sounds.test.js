import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { SOUND_EVENTS, soundFiles, soundsReadme } from './sounds.js';

test('soundFiles: only event names with a sound type, one per event, nothing oversized; no folder is no sounds', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nikki-sounds-'));
  for (const f of ['done.mp3', 'done.wav', 'hello.OGG', 'needsYou.txt', 'other.wav', 'constructor.wav', 'LIESMICH.txt']) fs.writeFileSync(path.join(dir, f), 'x');
  fs.writeFileSync(path.join(dir, 'land.wav'), Buffer.alloc(5 * 1024 * 1024 + 1));
  fs.mkdirSync(path.join(dir, 'lift.wav'));
  assert.deepEqual(soundFiles(dir), { done: 'done.mp3', hello: 'hello.OGG' });
  assert.deepEqual(soundFiles(path.join(dir, 'gone')), {});
  fs.rmSync(dir, { recursive: true });
});

test('the readme names every event', () => {
  for (const name of Object.keys(SOUND_EVENTS)) assert.match(soundsReadme(), new RegExp(`^${name}: `, 'm'));
});
