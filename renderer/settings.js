// The settings window. main owns the values: every change comes back as the whole set, and goes to the island too.
const $ = (id) => document.getElementById(id);
const api = window.companion;
let settings = {};

const icon = (d) => `<svg class="ti" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
const svg = (path) => `<svg class="icon" viewBox="0 0 16 16" aria-hidden="true"><path d="${path}"/></svg>`;
const PAGES = [
  ['general', 'Allgemein', '<path d="M4 6h16M4 12h16M4 18h16" /><circle cx="9" cy="6" r="2" /><circle cx="15" cy="12" r="2" /><circle cx="8" cy="18" r="2" />', 'idle'],
  ['notch', 'Notch & Leuchten', '<path d="M3 5h5v3a3 3 0 0 0 3 3h2a3 3 0 0 0 3-3V5h5" /><path d="M12 15v5M7 15l-2 4M17 15l2 4" />', 'music'],
  ['today', 'Heute', '<rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />', 'look'],
  ['modules', 'Module', '<path d="M12 3 3 8l9 5 9-5z" /><path d="m3 13 9 5 9-5" />', 'box'],
  ['claude', 'Claude', '<path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6 5.6 18.4" />', 'work'],
  ['discord', 'Discord', '<path d="M4 14v-2a8 8 0 0 1 16 0v2" /><rect x="3" y="14" width="4" height="6" rx="1.5" /><rect x="17" y="14" width="4" height="6" rx="1.5" />', 'listen'],
  ['nikki', 'Nikki', '<path d="M5 20V8l3-4 2 3h4l2-3 3 4v12z" /><path d="M9.5 12v1M14.5 12v1" />', 'wave'],
  ['keys', 'Tastenkürzel', '<rect x="2" y="6" width="20" height="12" rx="2" /><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10" />', 'think'],
];

// the cat keeps you company in the sidebar and has an opinion on each page
document.body.insertAdjacentHTML('beforeend', catDefs());
$('sideCat').innerHTML = catSvg();
const sideCat = $('sideCat').querySelector('.cat');

function showPage(id) {
  const page = PAGES.find((p) => p[0] === id) ?? PAGES[0];
  for (const s of document.querySelectorAll('.sPage')) s.hidden = s.dataset.page !== page[0];
  for (const b of document.querySelectorAll('.sideBtn')) {
    if (b.dataset.page === page[0]) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  }
  sideCat.dataset.mood = page[3];
  $('content').scrollTop = 0;
  if (page[0] === 'today') $('setCity').focus(); // the only thing to do there, and "Stadt eintragen" leads here
}
$('sideList').replaceChildren(
  ...PAGES.map(([id, label, path]) => {
    const b = h('button', { type: 'button', className: 'sideBtn', innerHTML: icon(path), onclick: () => showPage(id) }, label);
    b.dataset.page = id;
    return b;
  }),
);

function applySettings(s) {
  settings = s;
  $('setAutostart').checked = s.autostart;
  $('setAutostart').disabled = !s.autostartAvailable;
  $('autostartHint').hidden = s.autostartAvailable;
  for (const key of ['hotkey', 'closeKey']) if (capturing?.key !== key) $(key === 'hotkey' ? 'setHotkey' : 'setCloseKey').textContent = hotkeyLabel(s[key]);
  $('setSound').checked = !s.muted;
  $('setAwake').checked = s.keepAwake;
  $('setSleep').value = s.sleepMin;
  $('setHooks').checked = s.hooks;
  $('setRelay').checked = s.relay;
  $('setRelay').disabled = !s.hooks;
  $('setClaudePath').textContent = s.claudePath || 'nicht gefunden';
  $('setClaudePath').title = s.claudePath || '';
  $('setClaudePath').classList.toggle('bad', !s.claudePath);
  $('setBranch').checked = s.showBranch;
  if (document.activeElement !== $('setDiscordId')) $('setDiscordId').value = s.discordId;
  $('setDiscordSecret').placeholder = s.discordSecretSet ? 'gespeichert' : '';
  $('setDiscordJoin').checked = s.discordJoin;
  $('setGlow').checked = s.glow;
  $('setMic').checked = s.micSpectrum;
  $('setMic').disabled = !s.glow;
  $('setCatJump').checked = s.catJump;
  $('setIntro').checked = s.intro;
  $('setGlowLevel').value = s.glowLevel;
  $('setGlowLevel').disabled = !s.glow;
  if (document.activeElement !== $('setCity')) $('setCity').value = s.weatherCity;
  renderModules(s.modules);
}
const setSetting = async (key, value) => applySettings(await api.settingsSet(key, value));
$('setAutostart').addEventListener('change', (e) => setSetting('autostart', e.target.checked));
$('setSound').addEventListener('change', (e) => setSetting('muted', !e.target.checked));
$('setAwake').addEventListener('change', (e) => setSetting('keepAwake', e.target.checked));
$('setSleep').addEventListener('change', (e) => setSetting('sleepMin', Number(e.target.value)));
$('setHooks').addEventListener('change', (e) => setSetting('hooks', e.target.checked));
$('setRelay').addEventListener('change', (e) => setSetting('relay', e.target.checked));
$('setBranch').addEventListener('change', (e) => setSetting('showBranch', e.target.checked));
$('setCatJump').addEventListener('change', (e) => setSetting('catJump', e.target.checked));
$('setIntro').addEventListener('change', (e) => setSetting('intro', e.target.checked));
$('setCatPlaces').addEventListener('click', () => setSetting('catPlaces', null));
$('setGlow').addEventListener('change', (e) => setSetting('glow', e.target.checked));
$('setMic').addEventListener('change', (e) => setSetting('micSpectrum', e.target.checked));
$('setGlowLevel').addEventListener('change', (e) => setSetting('glowLevel', e.target.value));
$('setCity').addEventListener('change', (e) => setSetting('weatherCity', e.target.value));
async function setDiscord(key, value) {
  const s = await api.settingsSet(key, value);
  applySettings(s);
  $('discordMsg').textContent = s.error === 'nocrypt' ? 'Windows kann das Secret hier nicht verschlüsseln.' : s.error ? 'Das ist keine gültige Angabe.' : '';
  $('discordMsg').classList.toggle('bad', !!s.error);
}
$('setDiscordId').addEventListener('change', (e) => setDiscord('discordId', e.target.value));
$('setDiscordSecret').addEventListener('change', (e) => {
  setDiscord('discordSecret', e.target.value);
  e.target.value = '';
});
$('setDiscordJoin').addEventListener('change', (e) => setSetting('discordJoin', e.target.checked));
$('discordPortal').addEventListener('click', () => api.openExternal('https://discord.com/developers/applications'));

// ---- modules: order and on/off
function renderModules(list) {
  const box = $('setModuleList');
  const had = document.activeElement?.closest?.('#setModuleList [data-key]')?.dataset.key; // keep the focus across the re-render
  const control = (el, key) => ((el.dataset.key = key), el);
  const known = list.filter((m) => NikkiModules.has(m.id));
  box.replaceChildren(
    ...known.map((m, i) => {
      const mod = NikkiModules.get(m.id);
      const name = h('label', { className: 'modName', htmlFor: `mod-${m.id}`, innerHTML: mod.icon }, mod.title);
      const move = (d, label, path) => {
        const b = control(h('button', { type: 'button', className: 'iconBtn', innerHTML: svg(path), title: label, ariaLabel: `${mod.title} ${label}`, disabled: !known[i + d], onclick: () => moveModule(known, i, d) }), `${m.id}:${d}`);
        return b;
      };
      const sw = control(h('input', { type: 'checkbox', className: 'switch', id: `mod-${m.id}`, checked: m.on }), `${m.id}:on`);
      sw.setAttribute('role', 'switch');
      sw.addEventListener('change', () => setSetting('modules', known.map((x) => (x.id === m.id ? { ...x, on: sw.checked } : x))));
      return h('div', { className: 'setRow modRow' }, name, move(-1, 'nach oben', 'M4.5 9.5 8 6l3.5 3.5'), move(1, 'nach unten', 'M4.5 6.5 8 10l3.5-3.5'), sw);
    }),
  );
  const again = had && box.querySelector(`[data-key="${had}"]`);
  (again && !again.disabled ? again : again?.parentElement.querySelector('.switch'))?.focus();
}
function moveModule(list, i, d) {
  const next = [...list];
  [next[i], next[i + d]] = [next[i + d], next[i]];
  setSetting('modules', next);
}

// ---- keys: click, then press the new combo; main keeps the old one when the new one is taken
const KEYS = {
  hotkey: { btn: $('setHotkey'), msg: $('hotkeyMsg'), tell: (k) => `Nikki hört jetzt auf ${k}.`, tip: 'Esc bricht ab.' },
  closeKey: { btn: $('setCloseKey'), msg: $('closeKeyMsg'), tell: (k) => `${k} schließt Nikki, solange die Insel offen ist.`, tip: 'Esc belegt Esc. Rücktaste löscht.' },
};
let capturing = null; // the entry of KEYS being set
const keyMsg = (entry, text, bad = false) => {
  entry.msg.textContent = text;
  entry.msg.classList.toggle('bad', bad);
};
function stopCapture() {
  if (!capturing) return;
  const { btn, key } = capturing;
  capturing = null;
  removeEventListener('keydown', onHotkeyKey, true);
  btn.setAttribute('aria-pressed', 'false');
  btn.textContent = hotkeyLabel(settings[key]);
}
async function onHotkeyKey(e) {
  e.preventDefault();
  e.stopPropagation();
  const entry = capturing;
  const close = entry.key === 'closeKey';
  if (e.key === 'Escape' && !close) {
    stopCapture();
    return keyMsg(entry, '');
  }
  const plain = close && !e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey;
  const clear = plain && e.key === 'Backspace';
  const acc = clear ? '' : plain && e.key === 'Escape' ? 'Escape' : acceleratorFor(e);
  if (acc === null) return; // modifiers alone so far, or a key that cannot be a hotkey
  stopCapture();
  const s = await api.settingsSet(entry.key, acc);
  applySettings(s);
  if (s.error === 'taken') keyMsg(entry, `${hotkeyLabel(acc)} ist schon belegt.${close ? '' : ` Nikki bleibt bei ${hotkeyLabel(s.hotkey)}.`}`, true);
  else if (s.error) keyMsg(entry, `${hotkeyLabel(acc)} kann Windows nicht belegen.`, true);
  else keyMsg(entry, clear ? '' : entry.tell(hotkeyLabel(s[entry.key])));
}
for (const [key, entry] of Object.entries(KEYS)) {
  entry.key = key;
  entry.btn.addEventListener('click', () => {
    if (capturing === entry) return stopCapture();
    stopCapture();
    capturing = entry;
    entry.btn.setAttribute('aria-pressed', 'true');
    entry.btn.textContent = 'Drück die Tasten…';
    keyMsg(entry, entry.tip);
    addEventListener('keydown', onHotkeyKey, true);
  });
  entry.btn.addEventListener('blur', () => {
    if (capturing !== entry) return;
    stopCapture();
    keyMsg(entry, '');
  });
}

api.onSettingsChanged(applySettings);
api.onSettingsPage(showPage);
addEventListener('focus', () => api.settingsGet().then(applySettings)); // autostart or the Claude path may have changed outside
api.settingsGet().then((s) => {
  applySettings(s);
  showPage(location.hash.slice(1));
});
