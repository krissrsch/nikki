// Kalender (plan 3.3), local only: month with "+" next to its name, the chosen day's appointments below each other,
// one toast + chime 15 min before. Data: { events: [{ id, title, at, dur (min), reminded? }] }
const CAL_REMIND_MS = 15 * 60 * 1000;

// ---- pure, tested in modules.test.js
const calPad = (n) => String(n).padStart(2, '0');
function calDayKey(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${calPad(d.getMonth() + 1)}-${calPad(d.getDate())}`;
}
// one month, Monday first: null for each day before the 1st, then the days of the month
function calMonth(year, month) {
  const lead = (new Date(year, month, 1).getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  return [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
}
const calOnDay = (events, key) => events.filter((e) => calDayKey(e.at) === key).sort((a, b) => a.at - b.at);
// due for the one reminder: starts within 15 min and was not announced yet
const calDue = (events, now) => events.filter((e) => !e.reminded && e.at >= now && e.at - now <= CAL_REMIND_MS);

(() => {
  let data = { events: [] };
  let ctx;
  let root;
  let check;
  let month; // { y, m } shown in the card
  let picked = calDayKey(Date.now());
  let form = false; // the "+" form is open
  const ICON_PLUS = '<svg class="icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v10M3 8h10"/></svg>';
  const ICON_PREV = '<svg class="icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M9.5 4.5 6 8l3.5 3.5"/></svg>';
  const ICON_NEXT = '<svg class="icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M6.5 4.5 10 8l-3.5 3.5"/></svg>';
  const ICON_DEL = '<svg class="icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 4.5h9M6 4.5V3h4v1.5M5.5 4.5l.5 9h4l.5-9"/></svg>';
  const time = (ts) => new Date(ts).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  const inMin = (ms) => (ms < 60000 ? 'jetzt' : `in ${Math.ceil(ms / 60000)} min`);
  const dayOf = (key) => new Date(`${key}T00:00`);
  // "heute", "morgen" or "Mo., 2. Nov."
  function dayWord(ts, now = Date.now()) {
    const key = calDayKey(ts);
    if (key === calDayKey(now)) return 'heute';
    if (key === calDayKey(new Date(now).setDate(new Date(now).getDate() + 1))) return 'morgen';
    return new Date(ts).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' });
  }
  const iconBtn = (label, icon, onclick) => h('button', { type: 'button', className: 'iconBtn', ariaLabel: label, title: label, innerHTML: icon, onclick });
  const save = () => (ctx.save(data), ctx.changed());

  function render() {
    if (!root) return;
    const now = Date.now();
    month ??= { y: dayOf(picked).getFullYear(), m: dayOf(picked).getMonth() };
    const { y, m } = month;
    const shift = (d) => {
      month = { y: new Date(y, m + d, 1).getFullYear(), m: new Date(y, m + d, 1).getMonth() };
      render();
    };
    const plus = iconBtn('Termin hinzufügen', ICON_PLUS, () => {
      form = !form;
      render();
      root.querySelector(form ? '.calForm input' : '.calPlus')?.focus();
    });
    plus.classList.add('calPlus');
    plus.ariaExpanded = String(form);
    const head = h(
      'div',
      { className: 'calHead' },
      h('span', { className: 'calName', ariaLive: 'polite' }, new Date(y, m, 1).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })),
      iconBtn('Voriger Monat', ICON_PREV, () => shift(-1)),
      iconBtn('Nächster Monat', ICON_NEXT, () => shift(1)),
      plus,
    );
    const week = h('div', { className: 'calWeek', ariaHidden: 'true' }, ...['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((d) => h('span', {}, d)));
    const today = calDayKey(now);
    const days = calMonth(y, m).map((n) => {
      if (!n) return h('span');
      const key = `${y}-${calPad(m + 1)}-${calPad(n)}`;
      const count = calOnDay(data.events, key).length;
      const label = dayOf(key).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
      const b = h('button', { type: 'button', className: 'calDay', ariaPressed: String(key === picked), ariaLabel: count ? `${label}, ${count} ${count === 1 ? 'Termin' : 'Termine'}` : label }, String(n));
      b.classList.toggle('today', key === today);
      b.classList.toggle('has', count > 0);
      b.addEventListener('click', () => {
        picked = key;
        render();
        root.querySelector('.calDay[aria-pressed="true"]')?.focus();
      });
      return b;
    });
    const card = h('div', { className: 'calCard' }, head, week, h('div', { className: 'calDays' }, ...days));

    const word = dayWord(dayOf(picked).getTime(), now);
    const title = word === 'heute' || word === 'morgen' ? word[0].toUpperCase() + word.slice(1) : dayOf(picked).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
    const list = calOnDay(data.events, picked);
    const rows = list.map((e, i) => {
      const soon = e.at >= now && e.at - now < CAL_REMIND_MS;
      const row = h(
        'div',
        { className: `calEvent${e.at + e.dur * 60000 < now ? ' past' : ''}` },
        h('span', { className: `calBar c${i % 3}${soon ? ' soon' : ''}` }),
        h('span', { className: 'calTime' }, time(e.at)),
        h('span', { className: 'calTitle', title: `${e.title}, ${time(e.at)} bis ${time(e.at + e.dur * 60000)}` }, e.title),
        soon && h('span', { className: 'calMeta' }, inMin(e.at - now)),
        iconBtn(`${e.title} löschen`, ICON_DEL, () => {
          data.events = data.events.filter((x) => x !== e);
          save();
          render();
          plusFocus();
        }),
      );
      return row;
    });
    const empty = h('p', { className: 'calEmpty' }, word === 'heute' ? 'Heute ist nichts eingetragen.' : 'Nichts eingetragen.');
    const side = h('div', { className: 'calSide' }, h('span', { className: 'calDayName' }, title), form && addForm(), ...(rows.length ? rows : [empty]));
    root.replaceChildren(h('div', { className: 'calPage' }, card, side));
  }
  const plusFocus = () => root.querySelector('.calPlus')?.focus();

  function addForm() {
    const next = new Date();
    next.setHours(next.getHours() + 1, 0, 0, 0);
    const field = (label, input) => h('label', { className: 'calField' }, h('span', {}, label), input);
    const title = h('input', { type: 'text', name: 'title', required: true, maxLength: 80, placeholder: 'Was steht an?' });
    const dur = h('select', { name: 'dur' }, ...[15, 30, 45, 60, 90, 120].map((n) => h('option', { value: String(n), selected: n === 30 }, `${n} min`)));
    const close = () => {
      form = false;
      render();
      plusFocus();
    };
    const f = h(
      'form',
      { className: 'calForm', ariaLabel: 'Neuer Termin' },
      field('Titel', title),
      h(
        'div',
        { className: 'calFormRow' },
        field('Datum', h('input', { type: 'date', name: 'date', required: true, value: picked })),
        field('Uhrzeit', h('input', { type: 'time', name: 'time', required: true, value: `${calPad(next.getHours())}:00` })),
        field('Dauer', dur),
      ),
      h('div', { className: 'calFormActions' }, h('button', { type: 'button', className: 'btn', onclick: close }, 'Abbrechen'), h('button', { type: 'submit', className: 'btn primary' }, 'Eintragen')),
    );
    // Escape closes the form, not the island
    f.addEventListener('keydown', (e) => e.key === 'Escape' && (e.stopPropagation(), close()));
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(f);
      const at = new Date(`${fd.get('date')}T${fd.get('time')}`).getTime();
      const text = String(fd.get('title')).trim().slice(0, 80);
      if (!text || !Number.isFinite(at)) return title.focus();
      // created within the last 15 min: the user knows already, no reminder
      data.events.push({ id: crypto.randomUUID(), title: text, at, dur: Number(fd.get('dur')) || 30, reminded: at - Date.now() <= CAL_REMIND_MS });
      picked = calDayKey(at);
      month = { y: new Date(at).getFullYear(), m: new Date(at).getMonth() };
      save();
      close();
    });
    return f;
  }

  function remind() {
    const now = Date.now();
    const due = calDue(data.events, now);
    for (const e of due) {
      e.reminded = true;
      ctx.toast(`${e.title} ${inMin(e.at - now)}`);
    }
    if (due.length) {
      ctx.chime('needsYou');
      ctx.save(data);
    }
    ctx.changed(); // "in 12 min" on the tile
  }

  registerModule({
    id: 'calendar',
    title: 'Kalender',
    icon: '<svg class="ti" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>',
    async start(c) {
      ctx = c;
      const saved = await c.load();
      const ok = (e) => e && typeof e.title === 'string' && Number.isFinite(e.at) && Number.isFinite(e.dur);
      if (Array.isArray(saved?.events)) data = { events: saved.events.filter(ok) };
      remind();
      check = setInterval(remind, 20 * 1000);
    },
    stop() {
      clearInterval(check);
      root = null;
    },
    page(el) {
      root = el;
      render();
    },
    // Home (canvas Glas): today big on the left, the next two appointments of today beside it
    tile(el) {
      const now = Date.now();
      const date = (o) => new Date(now).toLocaleDateString('de-DE', o);
      const next = calOnDay(data.events, calDayKey(now)).filter((e) => e.at + e.dur * 60000 > now).slice(0, 2);
      el.append(
        h('div', { className: 'calToday' }, h('span', { className: 'calWeekday' }, date({ weekday: 'long' })), h('span', { className: 'calNum' }, date({ day: 'numeric' })), h('span', { className: 'tileSub' }, date({ month: 'long', year: 'numeric' }))),
        h(
          'div',
          { className: 'calNext' },
          ...(next.length
            ? next.map((e) => {
                const soon = e.at - now < CAL_REMIND_MS;
                return h('div', { className: 'calChip' }, h('span', { className: 'calChipTitle', title: e.title }, e.title), h('span', { className: `calChipTime${soon ? ' soon' : ''}` }, soon ? `${time(e.at)} · ${inMin(e.at - now)}` : time(e.at)));
              })
            : [h('p', { className: 'tileHint' }, 'Heute steht nichts an.')]),
        ),
      );
    },
  });
})();
