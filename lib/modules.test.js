import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { DEFAULT_MODULES, moduleFile, normalizeModules } from './modules.js';

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
  assert.deepEqual(DEFAULT_MODULES.map((m) => m.on), [true, true, true, true]);
});
