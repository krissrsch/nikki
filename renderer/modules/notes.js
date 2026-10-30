// Notizblock (plan 3.6): a dark tear-off pad as on the canvas. Flip with ‹ › or the wheel, "Rausreißen" deletes with a fall,
// a new sheet comes down from above. Data: { sheets: [{ id, at (last edit), text }], idx (the sheet on top) }

// ---- pure, tested in modules.test.js: "heute, 09:12", "gestern", "Montag", "12. Okt."
function notesWhen(at, now) {
  const a = new Date(at);
  const b = new Date(now);
  const days = Math.round((new Date(b.getFullYear(), b.getMonth(), b.getDate()) - new Date(a.getFullYear(), a.getMonth(), a.getDate())) / 864e5);
  if (days === 0) return `heute, ${a.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`;
  if (days === 1) return 'gestern';
  if (days > 1 && days < 7) return a.toLocaleDateString('de-DE', { weekday: 'long' });
  return a.toLocaleDateString('de-DE', { day: 'numeric', month: 'short', ...(a.getFullYear() !== b.getFullYear() && { year: 'numeric' }) });
}

(() => {
  let data = { sheets: [], idx: 0 };
  let ctx;
  let root;
  let busy = false; // an animation runs: no second flip on top of it
  let saveTimer;
  const ICON_PREV = '<svg class="icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M9.5 4 5.5 8l4 4"/></svg>';
  const ICON_NEXT = '<svg class="icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M6.5 4l4 4-4 4"/></svg>';
  const ICON_PLUS = '<svg class="icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v10M3 8h10"/></svg>';
  const ICON_TEAR = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3h14v11l-2.3 2-2.3-2-2.4 2-2.3-2-2.4 2L5 14z"/></svg>';
  const save = () => {
    clearTimeout(saveTimer);
    ctx.save(data);
    ctx.changed();
  };
  const later = (fn, ms) => setTimeout(fn, ctx.reduceMotion ? 0 : ms);
  const sheetEl = () => root?.querySelector('.sheet');
  const n = () => data.sheets.length;

  function render(anim = '') {
    if (!root) return;
    if (!n()) {
      root.replaceChildren(h('div', { className: 'padEmpty' }, 'Der Block ist leer', h('button', { type: 'button', className: 'btn', onclick: newSheet }, 'Neues Blatt')));
      return;
    }
    data.idx = Math.max(0, Math.min(data.idx, n() - 1));
    const s = data.sheets[data.idx];
    const below = n() - data.idx - 1; // the sheets still under this one peek out as edges
    const text = h('textarea', { className: 'sheetText', ariaLabel: 'Notizblatt', placeholder: 'Schreib etwas …', maxLength: 20000, spellcheck: false });
    text.value = s.text;
    text.addEventListener('input', () => {
      s.text = text.value;
      s.at = Date.now();
      clearTimeout(saveTimer);
      saveTimer = setTimeout(save, 400);
    });
    const sheet = h(
      'div',
      { className: `sheet ${anim}` },
      h('div', { className: 'holes', ariaHidden: 'true' }, ...Array.from({ length: 16 }, () => h('span'))),
      h('div', { className: 'perf' }),
      h('div', { className: 'sheetBody' }, h('div', { className: 'sheetMeta' }, h('span', {}, notesWhen(s.at, Date.now())), h('span', { className: 'sheetPos' }, `${data.idx + 1} / ${n()}`)), text),
    );
    const pad = h('div', { className: 'pad' }, below >= 2 && h('div', { className: 'padEdge e2' }), below >= 1 && h('div', { className: 'padEdge e1' }), sheet);
    pad.addEventListener('wheel', (e) => {
      // a long sheet scrolls its own text first
      const t = e.target.closest('textarea');
      if (t && (e.deltaY > 0 ? t.scrollTop + t.clientHeight < t.scrollHeight - 1 : t.scrollTop > 0)) return;
      if (e.deltaY > 15) next();
      else if (e.deltaY < -15) prev();
    }, { passive: true });
    const nav = (label, icon, onclick, off) => h('button', { type: 'button', className: 'iconBtn padNav', ariaLabel: label, title: label, innerHTML: icon, onclick, disabled: off });
    root.replaceChildren(
      pad,
      h(
        'div',
        { className: 'padBar' },
        nav('Vorheriges Blatt', ICON_PREV, prev, data.idx <= 0),
        nav('Nächstes Blatt', ICON_NEXT, next, data.idx >= n() - 1),
        h('span', { className: 'padHint' }, 'Blättern auch mit dem Mausrad'),
        h('span', { className: 'grow' }),
        h('button', { type: 'button', className: 'btn padBtn', innerHTML: ICON_PLUS, onclick: newSheet }, 'Neues Blatt'),
        h('button', { type: 'button', className: 'btn padBtn tearBtn', innerHTML: ICON_TEAR, onclick: tear }, 'Rausreißen'),
      ),
    );
  }
  // the sheet on top flips up and away, the next one settles in
  function next() {
    if (busy || data.idx >= n() - 1) return;
    busy = true;
    sheetEl().classList.add('flipUp');
    later(() => {
      data.idx++;
      save();
      render('settle');
    }, 200);
    later(() => ((busy = false), sheetEl()?.classList.remove('settle')), 450);
  }
  // back: the previous sheet folds down from above
  function prev() {
    if (busy || data.idx <= 0) return;
    busy = true;
    data.idx--;
    save();
    render('flipDown');
    later(() => ((busy = false), sheetEl()?.classList.remove('flipDown')), 310);
  }
  // tears the sheet off: it tilts, then falls out of the island; the one below settles in
  function tear() {
    if (busy || !n()) return;
    busy = true;
    sheetEl().classList.add('tear');
    later(() => {
      data.sheets.splice(data.idx, 1);
      save();
      render('settle');
    }, 520);
    later(() => ((busy = false), sheetEl()?.classList.remove('settle')), 770);
  }
  // a fresh sheet on top of the pad, coming down from above
  function newSheet() {
    if (busy) return;
    busy = true;
    data.sheets.splice(data.idx, 0, { id: crypto.randomUUID(), at: Date.now(), text: '' });
    save();
    render('flipDown');
    later(() => {
      busy = false;
      sheetEl()?.classList.remove('flipDown');
      root?.querySelector('.sheetText')?.focus();
    }, 310);
  }

  registerModule({
    id: 'notes',
    title: 'Notizen',
    icon: '<svg class="ti" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>',
    async start(c) {
      ctx = c;
      const saved = await c.load();
      if (Array.isArray(saved?.sheets)) data = { sheets: saved.sheets.filter((s) => s && typeof s.text === 'string'), idx: Number(saved.idx) || 0 };
    },
    stop() {
      if (saveTimer) save(); // typed just before switching it off
      root = null;
    },
    page(el) {
      root = el;
      render();
    },
    tile(el, c) {
      const top = data.sheets[Math.min(data.idx, n() - 1)];
      el.append(
        c.head(n() === 1 ? '1 Blatt' : `${n()} Blätter`),
        h('p', { className: `tileNote${top?.text.trim() ? '' : ' empty'}` }, top?.text.trim() || (n() ? 'Leeres Blatt' : 'Der Block ist leer')),
        h('button', { type: 'button', className: 'btn', onclick: () => (c.open(), newSheet()) }, 'Neues Blatt'),
      );
    },
  });
})();
