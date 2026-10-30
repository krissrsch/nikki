import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const src = readFileSync(new URL('./spectrum.js', import.meta.url), 'utf8');
const ctx = vm.runInNewContext(`${src}\n({ spectrumBars, specTop })`);
const bars = (levels) => JSON.parse(JSON.stringify(ctx.spectrumBars(levels)));
const full = Array(12).fill(1);

test('24 bars, 3 px on a 5 px grid, mirrored around the notch middle, 10 px wider than the notch', () => {
  const b = bars(full);
  assert.equal(b.length, 24);
  const xs = b.map((x) => x.x).sort((a, c) => a - c);
  for (let i = 1; i < xs.length; i++) assert.equal(xs[i] - xs[i - 1], i === 12 ? 6 : 5, `gap at ${i}`); // the middle pair sits 3 px apart
  assert.equal(xs[0], 572.5, 'left edge 4.5 px past the notch (577)');
  assert.equal(xs.at(-1) + 3, 691.5, 'right edge 4.5 px past the notch (687)');
  for (let i = 0; i < 12; i++) assert.equal(b[2 * i].x + 3 + b[2 * i + 1].x, 1264, `pair ${i} mirrored around 632`);
});

test('bass in the middle is tallest, treble outside is short; level scales the height', () => {
  const b = bars(full);
  assert.equal(Math.round(b[0].h), 52);
  assert.ok(b[22].h < 17 && b[22].h > 15);
  assert.ok(b.every((x, i) => i < 2 || x.h <= b[i - 2].h), 'never taller further out');
  assert.equal(bars([0.5, ...Array(11).fill(0)])[0].h, 26);
  assert.ok(bars(Array(12).fill(0)).every((x) => x.h === 0), 'silence draws nothing');
  assert.equal(bars([2, -1, 'x', ...Array(9).fill(0)])[0].h, 52, 'clamped to 0–1');
  assert.equal(bars([2, -1, 'x', ...Array(9).fill(0)])[2].h, 0);
});

test('each bar starts 2 px inside the notch contour: bottom, corner, beside it', () => {
  const b = bars(full);
  assert.equal(b[0].y, 34, 'middle: on the bottom (36)');
  assert.equal(ctx.specTop(577), 18);
  assert.equal(ctx.specTop(595), 36);
  assert.ok(ctx.specTop(580) > 18 && ctx.specTop(580) < 36, 'round corner');
  assert.equal(b[22].y, 16, 'outermost pair beside the notch: middle of its side');
});
