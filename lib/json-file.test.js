import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { editJson, readJson, writeJsonAtomic } from './json-file.js';

const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nikki-json-'));

test('readJson: missing file, BOM, broken file moved aside', () => {
  const dir = tmpDir();
  const f = path.join(dir, 'state.json');
  assert.equal(readJson(f), undefined);
  fs.writeFileSync(f, '﻿{"a":1}');
  assert.deepEqual(readJson(f), { a: 1 });
  fs.writeFileSync(f, '{"chats": [ {"id": 1}, {"id"'); // cut off mid-save
  assert.throws(() => readJson(f), SyntaxError);
  let moved;
  assert.equal(readJson(f, (p) => (moved = p)), undefined);
  assert.equal(fs.existsSync(f), false);
  assert.match(path.basename(moved), /^state\.json\.corrupt-\d+$/);
  assert.equal(fs.readFileSync(moved, 'utf8'), '{"chats": [ {"id": 1}, {"id"');
});

test('writeJsonAtomic: a write that dies midway keeps the old file and leaves no temp file', () => {
  const dir = tmpDir();
  const f = path.join(dir, 'state.json');
  writeJsonAtomic(f, { chats: [1, 2, 3] });
  const circular = {};
  circular.self = circular;
  assert.throws(() => writeJsonAtomic(f, { chats: [], circular }));
  assert.deepEqual(readJson(f), { chats: [1, 2, 3] });
  assert.deepEqual(fs.readdirSync(dir), ['state.json']);
});

test('writeJsonAtomic replaces the real file behind a symlink', (t) => {
  const dir = tmpDir();
  const real = path.join(dir, 'real.json');
  const link = path.join(dir, 'link.json');
  fs.writeFileSync(real, '{}');
  try {
    fs.symlinkSync(real, link);
  } catch {
    return t.skip('no symlink permission');
  }
  writeJsonAtomic(link, { a: 1 });
  assert.ok(fs.lstatSync(link).isSymbolicLink());
  assert.deepEqual(readJson(real), { a: 1 });
});

test('editJson: backup only once and only of the pristine file; no write when nothing changes', () => {
  const dir = tmpDir();
  const f = path.join(dir, 'settings.json');
  const backup = `${f}.bak`;
  const pristine = (s) => !s.ours;
  fs.writeFileSync(f, '{"model":"opus"}');
  assert.equal(editJson(f, (s) => ({ ...s, ours: 1 }), { backup, pristine }), true);
  assert.deepEqual(readJson(backup), { model: 'opus' });
  editJson(f, (s) => ({ ...s, ours: 2 }), { backup, pristine });
  fs.rmSync(backup);
  editJson(f, (s) => ({ ...s, ours: 3 }), { backup, pristine }); // file already has our changes: no new backup
  assert.equal(fs.existsSync(backup), false);
  const before = fs.statSync(f).mtimeMs;
  assert.equal(editJson(f, (s) => s, { backup, pristine }), false);
  assert.equal(fs.statSync(f).mtimeMs, before);
  assert.deepEqual(readJson(f), { model: 'opus', ours: 3 });
});

test('editJson: broken JSON throws and leaves the file alone', () => {
  const dir = tmpDir();
  const f = path.join(dir, 'settings.json');
  fs.writeFileSync(f, '{ nope');
  assert.throws(() => editJson(f, (s) => ({ ...s, x: 1 })), SyntaxError);
  assert.equal(fs.readFileSync(f, 'utf8'), '{ nope');
});
