import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const src = readFileSync(new URL('./hotkey.js', import.meta.url), 'utf8');
const { acceleratorFor, hotkeyLabel } = vm.runInNewContext(`${src}\n({ acceleratorFor, hotkeyLabel })`);
const press = (keyCode, mods = {}) => acceleratorFor({ keyCode, ctrlKey: false, altKey: false, shiftKey: false, metaKey: false, ...mods });

test('combos become Electron accelerators', () => {
  assert.equal(press(32, { ctrlKey: true, altKey: true }), 'Control+Alt+Space');
  assert.equal(press(75, { ctrlKey: true, shiftKey: true }), 'Control+Shift+K');
  assert.equal(press(49, { altKey: true }), 'Alt+1');
  assert.equal(press(78, { metaKey: true, altKey: true }), 'Alt+Super+N');
  assert.equal(press(113), 'F2', 'F-keys work alone');
  assert.equal(press(100, { ctrlKey: true }), 'Control+num4');
});

test('no accelerator for modifiers alone, plain keys or unknown keys', () => {
  assert.equal(press(17, { ctrlKey: true }), null);
  assert.equal(press(75), null);
  assert.equal(press(75, { shiftKey: true }), null, 'Shift+K is just a capital letter');
  assert.equal(press(186, { ctrlKey: true }), null, 'OEM keys differ per layout');
});

test('label in German', () => {
  assert.equal(hotkeyLabel('Control+Alt+Space'), 'Strg+Alt+Leertaste');
  assert.equal(hotkeyLabel('Super+Shift+K'), 'Win+Umschalt+K');
  assert.equal(hotkeyLabel(null), 'keins');
});
