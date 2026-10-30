// Settings: a key press -> Electron accelerator, and its German label. Pure; classic script (globals).
// keyCode, not key/code: it is the Windows virtual key Electron registers (Ctrl+Alt+Q gives key '@' on a German layout,
// and code is the US position, so Y and Z would swap).
const HOTKEY_NAMED = { 8: 'Backspace', 9: 'Tab', 13: 'Enter', 32: 'Space', 33: 'PageUp', 34: 'PageDown', 35: 'End', 36: 'Home', 37: 'Left', 38: 'Up', 39: 'Right', 40: 'Down', 45: 'Insert', 46: 'Delete' };

// null while only modifiers are down, for keys Electron cannot bind, and for combos that would fire while typing
function acceleratorFor(e) {
  const k = e.keyCode;
  const key =
    (k >= 48 && k <= 57) || (k >= 65 && k <= 90) ? String.fromCharCode(k) : k >= 112 && k <= 135 ? `F${k - 111}` : k >= 96 && k <= 105 ? `num${k - 96}` : HOTKEY_NAMED[k];
  if (!key) return null;
  const mods = [e.ctrlKey && 'Control', e.altKey && 'Alt', e.shiftKey && 'Shift', e.metaKey && 'Super'].filter(Boolean);
  if (!/^F\d/.test(key) && !mods.some((m) => m !== 'Shift')) return null;
  return [...mods, key].join('+');
}

const HOTKEY_LABELS = { Control: 'Strg', Shift: 'Umschalt', Super: 'Win', Space: 'Leertaste' };
const hotkeyLabel = (acc) => (acc ? acc.split('+').map((k) => HOTKEY_LABELS[k] ?? k).join('+') : 'keins');
