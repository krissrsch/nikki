import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const src = readFileSync(new URL('./hotkey.js', import.meta.url), 'utf8');
const { acceleratorFor, mouseAcceleratorFor, hotkeyLabel } = vm.runInNewContext(`${src}\n({ acceleratorFor, mouseAcceleratorFor, hotkeyLabel })`);
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

test('mouse buttons: middle and the side buttons, alone or with modifiers; never left or right', () => {
  const click = (button, mods = {}) => mouseAcceleratorFor({ button, ctrlKey: false, altKey: false, shiftKey: false, metaKey: false, ...mods });
  assert.equal(click(3), 'MouseBack');
  assert.equal(click(4, { ctrlKey: true }), 'Control+MouseForward');
  assert.equal(click(1, { altKey: true, shiftKey: true }), 'Alt+Shift+MouseMiddle');
  assert.equal(click(0), null);
  assert.equal(click(2), null);
  assert.equal(hotkeyLabel('Control+MouseBack'), 'Strg+M4');
  assert.deepEqual(['MouseMiddle', 'MouseBack', 'MouseForward'].map(hotkeyLabel), ['M3', 'M4', 'M5']);
});

test('label in German', () => {
  assert.equal(hotkeyLabel('Control+Alt+Space'), 'Strg+Alt+Leertaste');
  assert.equal(hotkeyLabel('Super+Shift+K'), 'Win+Umschalt+K');
  assert.equal(hotkeyLabel(null), 'keins');
});
