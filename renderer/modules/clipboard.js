// Zwischenablage (plan 3.8, opt-in): texts copied while the module is on, newest first. Main reads the clipboard and keeps
// the list (memory only; on disk with "Verlauf merken"). Click copies an entry again, "An Chat" puts it into the composer.
(() => {
  const api = globalThis.companion; // undefined in the unit test sandbox
  let state = { items: [], keep: false }; // from main: { items: [{ text, at }], keep }
  let info = ''; // "Kopiert." until the next change
  let ctx;
  let root;
  const line = (t) => t.replace(/\s+/g, ' ').trim();
  const count = (n) => `${n} ${n === 1 ? 'Eintrag' : 'Einträge'}`;
  // the page re-renders on every copy: keep the keyboard where it was
  const focused = () => root?.contains(document.activeElement) && document.activeElement.closest('[data-key]')?.dataset.key;
  const keyed = (el, key) => ((el.dataset.key = key), el);
  function take(s, focus = focused()) {
    state = s;
    ctx?.changed();
    render(focus);
  }
  api?.onClipboard((s) => {
    info = '';
    if (ctx) take(s);
  });

  function row(c, i) {
    return h(
      'div',
      { className: 'clipRow' },
      keyed(
        h('button', {
          type: 'button',
          className: 'clipText',
          title: `${c.text.slice(0, 400)}${c.text.length > 400 ? '…' : ''}`,
          onclick: () => api.clipCopy(c.text).then((s) => ((info = 'Kopiert.'), take(s, 'item:0'))),
        }, line(c.text)),
        `item:${i}`,
      ),
      h('span', { className: 'clipWhen' }, clockTime(c.at)),
      keyed(h('button', { type: 'button', className: 'todoChat', title: 'In den Chat schreiben, nicht abschicken', onclick: () => ctx.toChat(c.text) }, 'An Chat'), `chat:${i}`),
      keyed(
        h('button', {
          type: 'button',
          className: 'iconBtn',
          ariaLabel: `„${line(c.text).slice(0, 40)}“ löschen`,
          title: 'Löschen',
          innerHTML: ICON_TRASH,
          onclick: () => api.clipRemove(c.text).then((s) => take(s, state.items.length > 1 ? `del:${Math.min(i, state.items.length - 2)}` : 'keep')),
        }),
        `del:${i}`,
      ),
    );
  }

  function render(focus) {
    if (!root) return;
    const n = state.items.length;
    const keep = keyed(h('input', { type: 'checkbox', className: 'switch', id: 'clipKeep', checked: state.keep }), 'keep');
    keep.setAttribute('role', 'switch');
    keep.addEventListener('change', () => api.clipKeep(keep.checked).then((s) => take(s, 'keep')));
    root.replaceChildren(
      h(
        'div',
        { className: 'shelfBar' },
        h('span', { className: 'shelfInfo', role: 'status' }, info || (n ? `${count(n)} · Klick kopiert` : 'Noch nichts kopiert')),
        h('label', { className: 'clipKeep', htmlFor: 'clipKeep', title: 'Aus: Nikki hält den Verlauf nur im Speicher, nach einem Neustart ist er weg' }, 'Verlauf merken'),
        keep,
        keyed(h('button', { type: 'button', className: 'btn bad', disabled: !n, onclick: () => api.clipClear().then((s) => take(s, 'keep')) }, 'Alles löschen'), 'clear'),
      ),
      n ? h('div', { className: 'clipList' }, ...state.items.map(row)) : h('div', { className: 'shelfEmpty' }, 'Was du ab jetzt kopierst, steht hier.'),
    );
    if (focus) root.querySelector(`[data-key="${focus}"]`)?.focus();
  }

  registerModule({
    id: 'clipboard',
    title: 'Zwischenablage',
    icon: '<svg class="ti" viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="2" width="8" height="4" rx="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /></svg>',
    async start(c) {
      ctx = c;
      state = await api.clipGet();
    },
    stop() {
      ctx = root = null;
      state = { items: [], keep: false };
    },
    page(el) {
      root = el;
      info = '';
      render();
    },
  });
})();
