import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_CHARS, MAX_ITEMS, addClip, removeClip, restoreClips } from './clipboard.js';

const texts = (list) => list.map((c) => c.text);

test('newest on top; a text copied again moves up instead of coming twice', () => {
  let list = addClip([], 'a', 1);
  list = addClip(list, 'b', 2);
  list = addClip(list, 'c', 3);
  assert.deepEqual(texts(list), ['c', 'b', 'a']);
  list = addClip(list, 'a', 4);
  assert.deepEqual(list, [{ text: 'a', at: 4 }, { text: 'c', at: 3 }, { text: 'b', at: 2 }]);
});

test('nothing new keeps the very same list: blank, non-text and the top entry again', () => {
  const list = addClip([], 'a', 1);
  for (const t of ['', '   \n', null, undefined, 7, 'a']) assert.equal(addClip(list, t, 2), list, String(t));
});

test(`at most ${MAX_ITEMS} entries of at most ${MAX_CHARS} characters`, () => {
  let list = [];
  for (let i = 0; i < MAX_ITEMS + 5; i++) list = addClip(list, `t${i}`, i);
  assert.equal(list.length, MAX_ITEMS);
  assert.equal(list[0].text, `t${MAX_ITEMS + 4}`);
  assert.equal(list.at(-1).text, 't5', 'the oldest fall out');
  const long = addClip([], 'x'.repeat(MAX_CHARS + 100), 1);
  assert.equal(long[0].text.length, MAX_CHARS);
  assert.equal(addClip(long, 'x'.repeat(MAX_CHARS + 7), 2), long, 'the same text cut to the limit is no new entry');
});

test('remove one; a saved list comes back clean and capped', () => {
  assert.deepEqual(texts(removeClip(addClip(addClip([], 'a', 1), 'b', 2), 'a')), ['b']);
  const saved = [{ text: 'b', at: 2 }, { text: 'a', at: 1 }, { text: 'b', at: 0 }, { nope: 1 }, null, { text: '  ' }];
  assert.deepEqual(restoreClips(saved), [{ text: 'b', at: 2 }, { text: 'a', at: 1 }]);
  assert.deepEqual(restoreClips('kaputt'), []);
  assert.equal(restoreClips(Array.from({ length: 80 }, (_, i) => ({ text: `t${i}`, at: 80 - i }))).length, MAX_ITEMS);
});
