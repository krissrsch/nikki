import assert from 'node:assert/strict';
import { test } from 'node:test';
import { coversMonitor, fullscreenScript, parseCovered, powershellArgs } from './fullscreen.js';

const two = '0,0,1920,1080;1920,3,3840,1083';

test('parseCovered: monitors joined by ;, empty line and noise give none', () => {
  assert.deepEqual(parseCovered(two), [
    { l: 0, t: 0, r: 1920, b: 1080 },
    { l: 1920, t: 3, r: 3840, b: 1083 },
  ]);
  assert.deepEqual(parseCovered(''), []);
  assert.deepEqual(parseCovered('Add-Type: Fehler'), []);
  assert.deepEqual(parseCovered(null), []);
});

test('coversMonitor: only the island\'s own monitor counts, a few pixels off are fine', () => {
  const covered = parseCovered('0,0,1920,1080');
  assert.equal(coversMonitor(covered, { x: 0, y: 0, width: 1920, height: 1080 }), true);
  assert.equal(coversMonitor(covered, { x: 1, y: 0, width: 1920, height: 1079 }), true);
  assert.equal(coversMonitor(covered, { x: 1920, y: 3, width: 1920, height: 1080 }), false); // game on the other monitor
  assert.equal(coversMonitor([], { x: 0, y: 0, width: 1920, height: 1080 }), false);
});

test('powershellArgs: the script travels encoded, so quotes in the C# cannot break it', () => {
  const script = fullscreenScript(4242);
  assert.match(script, /Run\(4242\)/);
  const args = powershellArgs(script);
  assert.equal(args[args.indexOf('-EncodedCommand') + 1], Buffer.from(script, 'utf16le').toString('base64'));
});
