// Mitteilungen (opt-in): notifications other apps show in Windows, read by helper/NikkiHelper.exe while the module is on.
// Main keeps the last 30 in memory only. A new one lets the closed notch's edge sweep white once (glance: notify).
(() => {
  const api = globalThis.companion; // undefined in the unit test sandbox
  const FRESH_MS = 4000; // as long as the edge shows a new one
  let state = { access: null, items: [] }; // from main: access true | false | null (not asked yet), items [{ id, app, title, body, at }] newest first
  let ctx;
  let root;
  let freshTimer;
  const time = (at) => new Date(at).toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' });
  const fresh = () => !!state.items[0] && Date.now() - state.items[0].at < FRESH_MS;

  api?.onToasts((s) => {
    const newOne = s.items[0] && s.items[0].id !== state.items[0]?.id;
    state = s;
    if (!ctx) return;
    render();
    ctx.changed();
    if (newOne) {
      clearTimeout(freshTimer);
      freshTimer = setTimeout(() => ctx?.changed(), FRESH_MS + 50); // the sweep is over: what ranks below shows again
    }
  });

  function render() {
    if (!root) return;
    const n = state.items.length;
    root.replaceChildren(
      h(
        'div',
        { className: 'shelfBar' },
        h('span', { className: 'shelfInfo', role: 'status' }, n ? `${n} ${n === 1 ? 'Mitteilung' : 'Mitteilungen'}` : 'Keine neuen Mitteilungen'),
        h('button', { type: 'button', className: 'btn bad', disabled: !n, onclick: () => api.toastsClear().then((s) => ((state = s), render(), ctx?.changed())) }, 'Alles löschen'),
      ),
      state.access === false
        ? h('div', { className: 'shelfEmpty toastHint' }, 'Windows lässt Nikki keine Mitteilungen lesen. Erlaube es unter Einstellungen › Datenschutz › Benachrichtigungen.')
        : n
          ? h(
              'div',
              { className: 'clipList' },
              ...state.items.map((t) =>
                h(
                  'div',
                  { className: 'toastRow' },
                  h('div', { className: 'toastHead' }, h('span', { className: 'toastApp' }, t.app || 'App'), h('span', { className: 'clipWhen' }, time(t.at))),
                  t.title && h('span', { className: 'toastTitle' }, t.title),
                  t.body && h('span', { className: 'toastBody' }, t.body),
                ),
              ),
            )
          : h('div', { className: 'shelfEmpty' }, 'Was andere Apps dir ab jetzt melden, steht hier.'),
    );
  }

  registerModule({
    id: 'notifications',
    title: 'Mitteilungen',
    icon: '<svg class="ti" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>',
    async start(c) {
      ctx = c;
      state = await api.toastsGet();
    },
    stop() {
      clearTimeout(freshTimer);
      ctx = root = null;
      state = { access: null, items: [] };
    },
    page(el) {
      root = el;
      render();
    },
    glance: () => ({ notify: fresh() }),
  });
})();
