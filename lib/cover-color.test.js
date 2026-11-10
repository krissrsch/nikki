import test from 'node:test';
import assert from 'node:assert/strict';
import { coverColor } from './cover-color.js';

// BGRA pixels: [[r, g, b, count], ...]
const bitmap = (parts) => Buffer.from(parts.flatMap(([r, g, b, n]) => Array.from({ length: n }, () => [b, g, r, 255]).flat()));
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

test('cover colour: a red cover gives a light red', () => {
  const [r, g, b] = rgb(coverColor(bitmap([[200, 20, 30, 400]])));
  assert.ok(r > g + 60 && r > b + 60, `${r},${g},${b}`);
  assert.ok(r > 200, 'light enough to read on black');
});

test('cover colour: grey, black and white covers have none', () => {
  assert.equal(coverColor(bitmap([[128, 128, 128, 400]])), '');
  assert.equal(coverColor(bitmap([[0, 0, 0, 200], [255, 255, 255, 200]])), '');
  assert.equal(coverColor(Buffer.alloc(0)), '');
});

test('cover colour: the hue most lively pixels share wins, grey does not count', () => {
  const [r, g, b] = rgb(coverColor(bitmap([[90, 90, 90, 600], [30, 60, 220, 240], [220, 40, 40, 160]])));
  assert.ok(b > r && b > g, `${r},${g},${b}`);
});

test('cover colour: a few coloured specks on grey are not enough', () => {
  assert.equal(coverColor(bitmap([[100, 100, 100, 990], [0, 200, 0, 10]]), 1), '');
});
