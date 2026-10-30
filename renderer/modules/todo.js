// To-do (plan 3.5): global or per project; "An Chat" puts one into the composer of its project, never sends it.
// Data: { items: [{ id, text, done, scope: null (global) | project folder, at }] }

// ---- pure, tested in modules.test.js: the filter's items, open ones first (in the order they were written), then the done ones
function todoShown(items, filter, project) {
  const list = filter === 'project' ? items.filter((t) => t.scope === project) : items;
  return [...list.filter((t) => !t.done), ...list.filter((t) => t.done)];
}

(() => {
  let data = { items: [] };
  let filter = 'all'; // 'all' | 'project' (the project chosen in the chat)
  let ctx;
  let root;
  const ICON_DEL = '<svg class="icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 4.5h9M6 4.5V3h4v1.5M5.5 4.5l.5 9h4l.5-9"/></svg>';
  const save = () => (ctx.save(data), ctx.changed());
  const scopeName = (t) => (t.scope ? ctx.folderName(t.scope) : 'global');
  const check = (t, onchange) => {
    const cb = h('input', { type: 'checkbox', checked: t.done });
    cb.addEventListener('change', () => {
      t.done = cb.checked;
      save();
      onchange?.();
    });
    return cb;
  };

  function render(focus) {
    if (!root) return;
    const project = ctx.project();
    if (!project) filter = 'all';
    const chip = (label, value) =>
      h('button', {
        type: 'button',
        className: 'todoChip',
        ariaPressed: String(filter === value),
        title: value === 'project' ? project : 'Alle To-dos',
        onclick: () => ((filter = value), render()),
      }, label);
    const rows = todoShown(data.items, filter, project).map((t) => {
      const row = h(
        'div',
        { className: `todoRow${t.done ? ' done' : ''}` },
        h('label', { className: 'todoText' }, check(t, () => render(`${t.id}:check`)), h('span', { title: t.text }, t.text)),
        h('span', { className: 'todoScope', title: t.scope || 'für alle Projekte' }, scopeName(t)),
        h('button', { type: 'button', className: 'todoChat', title: 'In den Chat schreiben, nicht abschicken', onclick: () => ctx.toChat(t.text, t.scope) }, 'An Chat'),
        h('button', {
          type: 'button',
          className: 'iconBtn',
          ariaLabel: `„${t.text}“ löschen`,
          title: 'Löschen',
          innerHTML: ICON_DEL,
          onclick: () => {
            data.items = data.items.filter((x) => x !== t);
            save();
            render('new');
          },
        }),
      );
      row.querySelector('input').dataset.key = `${t.id}:check`;
      return row;
    });
    const input = h('input', { type: 'text', className: 'todoNew', placeholder: 'Neues To-do …', ariaLabel: 'Neues To-do', maxLength: 300 });
    input.dataset.key = 'new';
    input.addEventListener('keydown', (e) => {
      const text = input.value.trim();
      if (e.key !== 'Enter' || !text) return;
      // written in the project filter: belongs to that project; else global
      data.items.push({ id: crypto.randomUUID(), text, done: false, scope: filter === 'project' ? project : null, at: Date.now() });
      save();
      render('new');
    });
    const empty = h('p', { className: 'todoEmpty' }, filter === 'project' ? `Für ${ctx.folderName(project)} ist nichts offen.` : 'Nichts zu tun. Schreib unten eins rein.');
    root.replaceChildren(
      h('div', { className: 'todoFilter', role: 'group', ariaLabel: 'Welche To-dos' }, chip('Alle', 'all'), project && chip(ctx.folderName(project), 'project')),
      h('div', { className: 'todoList' }, ...(rows.length ? rows : [empty])),
      input,
    );
    if (focus) root.querySelector(`[data-key="${focus}"]`)?.focus();
  }

  registerModule({
    id: 'todo',
    title: 'To-do',
    icon: '<svg class="ti" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6h11M9 12h11M9 18h11" /><path d="m3 6 1.5 1.5L7 5M3 12l1.5 1.5L7 11M3 18l1.5 1.5L7 17" /></svg>',
    async start(c) {
      ctx = c;
      const saved = await c.load();
      if (Array.isArray(saved?.items)) data = { items: saved.items.filter((t) => t && typeof t.text === 'string') };
    },
    stop() {
      root = null;
    },
    page(el) {
      root = el;
      render();
    },
    tile(el, c) {
      const open = data.items.filter((t) => !t.done).length;
      el.append(c.head(`${open} offen`));
      const first = todoShown(data.items, 'all').slice(0, 3);
      if (!first.length) {
        el.append(h('span', { className: 'tileBig' }, 'Nichts offen'), h('span', { className: 'tileSub' }, 'Neue To-dos schreibst du im To-do-Tab.'));
        return;
      }
      el.append(h('div', { className: 'tileList' }, ...first.map((t) => h('label', { className: `tileCheck${t.done ? ' done' : ''}` }, check(t, () => root && render()), h('span', {}, t.text)))));
    },
  });
})();
