// Ablage (plan 3.4): copies of files dropped on the island (main keeps them in userData/shelf and does every file operation)
// and text cards. Click selects (several), double click or Enter opens, dragging out copies: the shelf keeps its copy.
// A drop outside the chat tab lands here (app.js calls drop()).
(() => {
  const api = globalThis.companion; // undefined in the unit test sandbox
  let items = []; // [{ id, name, size, path?, thumb?, text? }] from main, oldest first
  let picked = new Set(); // selected ids
  let msg = ''; // what went wrong last, until the next change
  let asking = false; // "Alles leeren" asks once, here in the page
  let dragging = false; // a text card on its way out must not come back as a new one
  let ctx;
  let root;
  const isText = (i) => typeof i.text === 'string';
  const count = (n) => `${n} ${n === 1 ? 'Eintrag' : 'Einträge'}`;
  const thumb = (i) => h('span', { className: 'shelfThumb' }, i.thumb ? h('img', { src: i.thumb, alt: '' }) : isText(i) ? 'Aa' : (/\.([^.]+)$/.exec(i.name)?.[1] ?? '').slice(0, 4).toUpperCase());
  function take(r, focus) {
    items = r.items;
    msg = r.errors.join(' ');
    picked = new Set([...picked].filter((id) => items.some((i) => i.id === id)));
    render(focus);
    ctx?.changed();
  }
  const fail = (e) => take({ items, errors: [`Die Ablage hakt gerade: ${e.message ?? e}`] });
  async function open(i) {
    if (isText(i)) {
      await navigator.clipboard.writeText(i.text).catch(() => {});
      msg = '';
      return setInfo('Text kopiert.');
    }
    const why = await api.shelfOpen(i.id);
    if (why) take({ items, errors: [`„${i.name}“ lässt sich nicht öffnen: ${why}`] });
  }
  const setInfo = (text) => root?.querySelector('.shelfInfo') && (root.querySelector('.shelfInfo').textContent = text);
  // files go in as quoted paths (like a drop into the chat), text cards as their text
  function attach() {
    const sel = items.filter((i) => picked.has(i.id));
    ctx.toChat([sel.filter((i) => !isText(i)).map((i) => `"${i.path}"`).join(' '), ...sel.filter(isText).map((i) => i.text)].filter(Boolean).join('\n\n'));
  }

  function item(i) {
    const hint = isText(i) ? 'Doppelklick kopiert' : 'Doppelklick öffnet, rausziehen legt eine Kopie ab';
    const b = h('button', { type: 'button', className: 'shelfItem', draggable: true, title: `${i.name} · ${i.size}\n${hint}`, ariaPressed: String(picked.has(i.id)) }, thumb(i), h('span', { className: 'shelfName' }, i.name));
    b.dataset.key = i.id;
    b.addEventListener('click', () => {
      picked.has(i.id) ? picked.delete(i.id) : picked.add(i.id);
      render(i.id);
    });
    b.addEventListener('dblclick', () => open(i));
    b.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return; // Space selects (click), Enter opens
      e.preventDefault();
      open(i);
    });
    b.addEventListener('dragstart', (e) => {
      if (isText(i)) {
        dragging = true;
        e.dataTransfer.setData('text/plain', i.text);
        e.dataTransfer.effectAllowed = 'copy';
        return;
      }
      e.preventDefault(); // Windows drags the real files (main: startDrag)
      const ids = picked.has(i.id) ? items.filter((x) => picked.has(x.id) && !isText(x)).map((x) => x.id) : [i.id];
      api.shelfDrag(ids);
    });
    b.addEventListener('dragend', () => (dragging = false));
    return b;
  }

  function render(focus) {
    if (!root) return;
    const sel = items.filter((i) => picked.has(i.id)).length;
    const btn = (label, cls, onclick, key, disabled = false) => {
      const b = h('button', { type: 'button', className: `btn ${cls}`, onclick, disabled }, label);
      b.dataset.key = key; // keeps the focus across the re-render
      return b;
    };
    const bar = asking
      ? [
          h('span', { className: 'shelfInfo' }, 'Alles aus der Ablage löschen? Das geht nicht rückgängig.'),
          btn('Abbrechen', '', () => ((asking = false), render('clear')), 'cancel'),
          btn('Leeren', 'bad', () => ((asking = false), api.shelfClear().then((r) => take(r, 'clear'), fail)), 'yes'),
        ]
      : [
          h('span', { className: 'shelfInfo', role: 'status' }, items.length ? `${count(items.length)} · ${sel} ausgewählt · rausziehen zum Ablegen` : 'Die Ablage ist leer'),
          btn('An Chat anhängen', '', attach, 'attach', !sel),
          btn('Alles leeren', 'bad', () => ((asking = true), render('cancel')), 'clear', !items.length),
        ];
    root.replaceChildren(
      h('div', { className: 'shelfBar' }, ...bar),
      msg && h('p', { className: 'shelfMsg', role: 'alert' }, msg),
      items.length ? h('div', { className: 'shelfGrid' }, ...items.map(item)) : h('div', { className: 'shelfEmpty' }, 'Zieh Dateien oder Text auf die Insel'),
    );
    if (focus) root.querySelector(`[data-key="${focus}"]`)?.focus();
  }

  registerModule({
    id: 'shelf',
    title: 'Ablage',
    icon: '<svg class="ti" viewBox="0 0 24 24" aria-hidden="true"><path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.7 4H7.3a2 2 0 0 0-1.8 1.1z" /></svg>',
    async start(c) {
      ctx = c;
      items = await api.shelfList();
    },
    stop() {
      ctx = root = null;
      picked.clear();
    },
    page(el) {
      root = el;
      render();
      // files may have gone from the folder meanwhile
      api.shelfList().then((list) => JSON.stringify(list) !== JSON.stringify(items) && take({ items: list, errors: [] }), fail);
    },
    // { paths, text } from a drop on the island while the chat tab is not open
    async drop({ paths, text }) {
      if (dragging) return;
      await (paths.length ? api.shelfAdd(paths) : api.shelfAddText(text)).then(take, fail);
    },
  });
})();
