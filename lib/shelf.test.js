import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { formatSize, planAdd, shelfFile, uniqueName, SHELF_FILE_MAX, SHELF_TOTAL_MAX } from './shelf.js';

const MB = 1024 ** 2;

test('formatSize: like the canvas, German comma', () => {
  assert.equal(formatSize(0), '0 B');
  assert.equal(formatSize(900), '900 B');
  assert.equal(formatSize(12 * 1024), '12 KB');
  assert.equal(formatSize(340 * 1024), '340 KB');
  assert.equal(formatSize(1.2 * MB), '1,2 MB');
  assert.equal(formatSize(1 * MB), '1 MB', 'no ",0"');
  assert.equal(formatSize(18 * MB), '18 MB');
  assert.equal(formatSize(2 * 1024 * MB), '2 GB');
});

test('uniqueName: free names stay, taken ones get (2), (3), case does not matter', () => {
  assert.equal(uniqueName('a.png', []), 'a.png');
  assert.equal(uniqueName('a.png', ['A.PNG']), 'a (2).png');
  assert.equal(uniqueName('a.png', ['a.png', 'a (2).png']), 'a (3).png');
  assert.equal(uniqueName('README', ['readme']), 'README (2)');
  assert.equal(uniqueName('archiv.tar.gz', ['archiv.tar.gz']), 'archiv.tar (2).gz');
});

test('planAdd: 500 MB per file, 2 GB in all, names unique within one drop', () => {
  const { ok, errors } = planAdd(
    [
      { src: 'C:\\x\\a.png', name: 'a.png', size: MB },
      { src: 'C:\\y\\a.png', name: 'a.png', size: MB },
      { src: 'C:\\big.iso', name: 'big.iso', size: SHELF_FILE_MAX + 1 },
      { src: 'C:\\max.bin', name: 'max.bin', size: SHELF_FILE_MAX },
    ],
    0,
    ['a.png'],
  );
  assert.deepEqual(ok.map((f) => f.name), ['a (2).png', 'a (3).png', 'max.bin']);
  assert.equal(ok[0].src, 'C:\\x\\a.png');
  assert.equal(errors.length, 1);
  assert.match(errors[0], /„big\.iso“ ist zu groß \(500 MB\)\. .*500 MB pro Datei/);

  const full = planAdd([{ src: 'C:\\b', name: 'b', size: 2 * MB }, { src: 'C:\\c', name: 'c', size: MB }], SHELF_TOTAL_MAX - 1.5 * MB, []);
  assert.deepEqual(full.ok.map((f) => f.name), ['c'], 'what still fits goes in');
  assert.match(full.errors[0], /„b“ passt nicht mehr rein: Die Ablage fasst 2 GB/);
});

test('shelfFile: plain names inside the folder only', () => {
  const dir = path.join('C:', 'data', 'shelf');
  assert.equal(shelfFile(dir, 'a (2).png'), path.join(dir, 'a (2).png'));
  for (const bad of ['', '.', '..', '../state.json', '..\\x', 'a/b', 'C:x', 'a:stream', 'x\0y', null, 7]) {
    assert.throws(() => shelfFile(dir, bad), /invalid shelf name/, JSON.stringify(bad));
  }
});
