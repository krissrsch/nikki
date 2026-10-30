import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { DEFAULT_MODULES, moduleFile, normalizeModules, withNewModules } from './modules.js';

test('moduleFile: one file per id inside the folder, no way out', () => {
  const dir = path.join('C:', 'data', 'modules');
  assert.equal(moduleFile(dir, 'notes'), path.join(dir, 'notes.json'));
  assert.equal(moduleFile(dir, 'to-do-2'), path.join(dir, 'to-do-2.json'));
  for (const bad of ['', '..', '../state', '..\\state', 'a/b', 'C:x', 'Notes', 'a.b', 'x'.repeat(41), null, 7, { id: 'a' }]) {
    assert.throws(() => moduleFile(dir, bad), /invalid module id/, JSON.stringify(bad));
  }
});

test('normalizeModules: keeps order, drops bad and repeated ids, coerces on', () => {
  assert.deepEqual(
    normalizeModules([{ id: 'timer', on: 1 }, { id: 'notes' }, { id: '../x', on: true }, { id: 'timer', on: false }, null, 'todo']),
    [{ id: 'timer', on: true }, { id: 'notes', on: false }],
  );
  assert.equal(normalizeModules(undefined), DEFAULT_MODULES);
  assert.equal(normalizeModules({ id: 'notes' }), DEFAULT_MODULES);
  assert.deepEqual(normalizeModules([]), []);
  assert.deepEqual(DEFAULT_MODULES.map((m) => `${m.id}:${m.on}`), ['music:true', 'calendar:true', 'shelf:true', 'todo:true', 'notes:true', 'timer:true', 'clipboard:false']);
});

test('withNewModules: music and shelf join an older list next to their neighbours, the user keeps order and switches', () => {
  const ids = (list) => list.map((m) => `${m.id}${m.on ? '' : ':off'}`);
  const old = ['calendar', 'todo', 'notes', 'timer'].map((id) => ({ id, on: true }));
  assert.deepEqual(withNewModules(old), DEFAULT_MODULES, 'an untouched 1.1 list becomes the new default');
  const mine = [{ id: 'timer', on: true }, { id: 'notes', on: false }, { id: 'calendar', on: false }, { id: 'todo', on: true }];
  assert.deepEqual(ids(withNewModules(mine)), ['music', 'timer', 'clipboard:off', 'notes:off', 'calendar:off', 'shelf', 'todo']);
  assert.deepEqual(withNewModules(DEFAULT_MODULES), DEFAULT_MODULES, 'nothing new, nothing changes');
  assert.deepEqual(ids(withNewModules([{ id: 'shelf', on: false }])), ['music', 'calendar', 'shelf:off', 'todo', 'notes', 'timer', 'clipboard:off']);
  // a 1.2 list with all six on: the clipboard joins at the end, switched off (opt-in)
  const six = ['music', 'calendar', 'shelf', 'todo', 'notes', 'timer'].map((id) => ({ id, on: true }));
  assert.deepEqual(withNewModules(six).at(-1), { id: 'clipboard', on: false });
  assert.notEqual(withNewModules(old)[0], DEFAULT_MODULES[0], 'copies, not the shared defaults');
});
