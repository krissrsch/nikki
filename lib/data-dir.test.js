import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { moveDataDir } from './data-dir.js';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nikki-data-'));

test('data folder: the old desktopcompanion folder moves to notch-nikki, its paths and the general chat follow', () => {
  const appData = tmp();
  const claude = tmp();
  const from = path.join(appData, 'desktopcompanion');
  const general = path.join(from, 'allgemein');
  fs.mkdirSync(path.join(from, 'voice'), { recursive: true });
  fs.writeFileSync(path.join(from, 'voice', 'model.bin'), 'x');
  fs.writeFileSync(path.join(from, 'state.json'), JSON.stringify({ chats: [{ cwd: general }, { cwd: 'C:\\Projekt' }], models: { [general]: 'opus' } }));
  const old = path.join(claude, 'projects', general.replace(/[^a-zA-Z0-9]/g, '-'));
  fs.mkdirSync(old, { recursive: true });
  fs.writeFileSync(path.join(old, 'abc.jsonl'), '{}');

  const to = moveDataDir(appData, claude);
  assert.equal(to, path.join(appData, 'notch-nikki'));
  assert.ok(!fs.existsSync(from), 'moved, not copied');
  assert.equal(fs.readFileSync(path.join(to, 'voice', 'model.bin'), 'utf8'), 'x');
  const state = JSON.parse(fs.readFileSync(path.join(to, 'state.json'), 'utf8'));
  const newGeneral = path.join(to, 'allgemein');
  assert.deepEqual(state.chats.map((c) => c.cwd), [newGeneral, 'C:\\Projekt']);
  assert.deepEqual(Object.keys(state.models), [newGeneral]);
  assert.ok(fs.existsSync(path.join(claude, 'projects', newGeneral.replace(/[^a-zA-Z0-9]/g, '-'), 'abc.jsonl')), 'transcripts copied');
  assert.ok(fs.existsSync(path.join(old, 'abc.jsonl')), 'the old transcripts stay');

  assert.equal(moveDataDir(appData, claude), to, 'once: the next start finds the new folder');
});

test('data folder: a fresh install just uses notch-nikki; an existing notch-nikki is never replaced', () => {
  const appData = tmp();
  assert.equal(moveDataDir(appData, tmp()), path.join(appData, 'notch-nikki'));
  fs.mkdirSync(path.join(appData, 'desktopcompanion'));
  fs.mkdirSync(path.join(appData, 'notch-nikki'));
  assert.equal(moveDataDir(appData, tmp()), path.join(appData, 'notch-nikki'));
  assert.ok(fs.existsSync(path.join(appData, 'desktopcompanion')), 'left alone');
});
