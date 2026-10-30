import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mediaCommand } from './media.js';

test('mediaCommand: known commands pass, volume is a number clamped to 0-100, anything else is null', () => {
  for (const c of ['toggle', 'play', 'pause', 'next', 'prev', 'mute', 'unmute']) assert.equal(mediaCommand(c), c);
  assert.equal(mediaCommand('volume', 42.4), 'volume 42');
  assert.equal(mediaCommand('volume', 140), 'volume 100');
  assert.equal(mediaCommand('volume', -3), 'volume 0');
  for (const v of [undefined, null, '', '50', NaN, Infinity]) assert.equal(mediaCommand('volume', v), null, `volume ${String(v)}`);
  for (const c of ['seek', 'toggle\nvolume 0', 'TOGGLE', '', null, { cmd: 'next' }]) assert.equal(mediaCommand(c, 1), null, JSON.stringify(c));
});
