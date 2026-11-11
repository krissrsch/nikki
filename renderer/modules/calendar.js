// Kalender (plan 3.3), local only: month with "+" next to its name, the chosen day's appointments below each other,
// one toast + chime 15 min before. Data: { events: [{ id, title, at, dur (min), repeat?, reminded? }] }
// repeat: day | workday | week | month, from the event's own day on; reminded: the start (ts) last announced, true in old data
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
const CAL_REPEATS = { day: 'täglich', workday: 'werktags', week: 'wöchentlich', month: 'monatlich' };
// when e starts on the day `key`: its own day, or a repeat from that day on; null if not that day
function calAt(e, key) {
  if (calDayKey(e.at) === key) return e.at;
  if (!CAL_REPEATS[e.repeat]) return null;
  const s = new Date(e.at);
  const d = new Date(`${key}T00:00`);
  if (d < new Date(s.getFullYear(), s.getMonth(), s.getDate())) return null;
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); // a series on the 31st falls on the 30th or the 28th in shorter months
  const on = { day: true, workday: d.getDay() % 6 !== 0, week: d.getDay() === s.getDay(), month: d.getDate() === Math.min(s.getDate(), last) }[e.repeat];
  return on ? new Date(d.getFullYear(), d.getMonth(), d.getDate(), s.getHours(), s.getMinutes()).getTime() : null;
}
// the appointments of a day, a repeat as a copy with that day's start; src is the stored one (edit, delete, reminded)
const calOnDay = (events, key) =>
  events
    .flatMap((e) => {
      const at = calAt(e, key);
      return at === null ? [] : [{ ...e, at, src: e }];
    })
    .sort((a, b) => a.at - b.at);
// due for the one reminder: starts within 15 min and this start was not announced yet (today's and, near midnight, tomorrow's)
const calDue = (events, now) =>
  [calDayKey(now), calDayKey(now + CAL_REMIND_MS)]
    .filter((k, i, all) => all.indexOf(k) === i)
    .flatMap((k) => calOnDay(events, k))
    .filter((o) => o.src.reminded !== true && o.src.reminded !== o.at && o.at >= now && o.at - now <= CAL_REMIND_MS);

(() => {
  let data = { events: [] };
  let ctx;
  let root;
  let check;
  let month; // { y, m } shown in the card
  let picked = calDayKey(Date.now());
  let form = false; // the form is open: true for a new appointment, or the appointment being changed
  const ICON_PLUS = '<svg class="icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v10M3 8h10"/></svg>';
  const ICON_PREV = '<svg class="icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M9.5 4.5 6 8l3.5 3.5"/></svg>';
  const ICON_NEXT = '<svg class="icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M6.5 4.5 10 8l-3.5 3.5"/></svg>';
  const ICON_REPEAT = '<svg class="icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 7a5 5 0 0 1 9-2.5M13 9a5 5 0 0 1-9 2.5M12 2v2.5H9.5M4 14v-2.5h2.5"/></svg>';
  const ICON_DEL = '<svg class="icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 4.5h9M6 4.5V3h4v1.5M5.5 4.5l.5 9h4l.5-9"/></svg>';
  const time = (ts) => new Date(ts).toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' });
  const inMin = (ms) => (ms < 60000 ? 'jetzt' : `in ${Math.ceil(ms / 60000)} min`);
  const dayOf = (key) => new Date(`${key}T00:00`);
  // "heute", "morgen" or "Mo., 2. Nov."
  function dayWord(ts, now = Date.now()) {
    const key = calDayKey(ts);
    if (key === calDayKey(now)) return 'heute';
    if (key === calDayKey(new Date(now).setDate(new Date(now).getDate() + 1))) return 'morgen';
    return new Date(ts).toLocaleDateString(LOCALE, { weekday: 'short', day: 'numeric', month: 'short' });
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
    const todayKey = calDayKey(now);
    const away = picked !== todayKey || y !== new Date(now).getFullYear() || m !== new Date(now).getMonth();
    const backToToday = () => {
      picked = todayKey;
      month = null;
      render();
      root.querySelector('.calDay[aria-pressed="true"]')?.focus();
    };
    const plus = iconBtn('Termin hinzufügen', ICON_PLUS, () => {
      form = form !== true;
      render();
      root.querySelector(form ? '.calForm input' : '.calPlus')?.focus();
    });
    plus.classList.add('calPlus');
    plus.ariaExpanded = String(form === true);
    const head = h(
      'div',
      { className: 'calHead' },
      // with the Heute button beside it the month goes short ("Sept. 2027"), else the year would be cut
      h('span', { className: 'calName', ariaLive: 'polite', title: new Date(y, m, 1).toLocaleDateString(LOCALE, { month: 'long', year: 'numeric' }) }, new Date(y, m, 1).toLocaleDateString(LOCALE, { month: away ? 'short' : 'long', year: 'numeric' })),
      iconBtn('Voriger Monat', ICON_PREV, () => shift(-1)),
      iconBtn('Nächster Monat', ICON_NEXT, () => shift(1)),
      away && h('button', { type: 'button', className: 'btn calTodayBtn', onclick: backToToday }, 'Heute'),
      plus,
    );
    const week = h('div', { className: 'calWeek', ariaHidden: 'true' }, ...['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((d) => h('span', {}, d)));
    const days = calMonth(y, m).map((n) => {
      if (!n) return h('span');
      const key = `${y}-${calPad(m + 1)}-${calPad(n)}`;
      const count = data.events.filter((e) => calAt(e, key) !== null).length;
      const label = dayOf(key).toLocaleDateString(LOCALE, { weekday: 'long', day: 'numeric', month: 'long' });
      const b = h('button', { type: 'button', className: 'calDay', ariaPressed: String(key === picked), ariaLabel: count ? `${label}, ${count} ${count === 1 ? 'Termin' : 'Termine'}` : label }, String(n));
      b.classList.toggle('today', key === todayKey);
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
    const title = word === 'heute' || word === 'morgen' ? word[0].toUpperCase() + word.slice(1) : dayOf(picked).toLocaleDateString(LOCALE, { weekday: 'long', day: 'numeric', month: 'long' });
    const list = calOnDay(data.events, picked);
    const rows = list.map((e, i) => {
      const soon = e.at >= now && e.at - now < CAL_REMIND_MS;
      const row = h(
        'div',
        { className: `calEvent${e.at + e.dur * 60000 < now ? ' past' : ''}`, title: `${time(e.at)} bis ${time(e.at + e.dur * 60000)}` },
        h('span', { className: `calBar c${i % 3}${soon ? ' soon' : ''}` }),
        h('span', { className: 'calTime' }, time(e.at)),
        h('button', { type: 'button', className: 'calTitle', title: 'Ändern', onclick: () => ((form = e.src), render(), root.querySelector('.calForm input')?.focus()) }, e.title),
        e.repeat && h('span', { className: 'calRepeat', role: 'img', ariaLabel: `wiederholt sich ${CAL_REPEATS[e.repeat]}`, title: `wiederholt sich ${CAL_REPEATS[e.repeat]}`, innerHTML: ICON_REPEAT }),
        soon && h('span', { className: 'calMeta' }, inMin(e.at - now)),
        iconBtn(e.repeat ? `${e.title} mit allen Wiederholungen löschen` : `${e.title} löschen`, ICON_DEL, () => {
          data.events = data.events.filter((x) => x !== e.src);
          save();
          render();
          plusFocus();
        }),
      );
      return row;
    });
    const empty = h('p', { className: 'calEmpty' }, word === 'heute' ? 'Heute ist nichts eingetragen.' : 'Nichts eingetragen.');
    const side = h('div', { className: 'calSide' }, h('span', { className: 'calDayName' }, title), form && addForm(form === true ? null : form), ...(rows.length ? rows : [empty]));
    root.replaceChildren(h('div', { className: 'calPage' }, card, side));
  }
  const plusFocus = () => root.querySelector('.calPlus')?.focus();

  // edit: the appointment to change, else a new one
  function addForm(edit) {
    const next = edit ? new Date(edit.at) : new Date();
    if (!edit) next.setHours(next.getHours() + 1, 0, 0, 0);
    const field = (label, input) => h('label', { className: 'calField' }, h('span', {}, label), input);
    const repeat = h('select', { name: 'repeat' }, h('option', { value: '', selected: !edit?.repeat }, 'nie'), ...Object.entries(CAL_REPEATS).map(([v, label]) => h('option', { value: v, selected: edit?.repeat === v }, label)));
    const title = h('input', { type: 'text', name: 'title', required: true, maxLength: 80, placeholder: 'Was steht an?', value: edit?.title ?? '' });
    title.addEventListener('input', () => title.removeAttribute('aria-invalid'));
    const durs = [15, 30, 45, 60, 90, 120, 180, 240];
    const want = edit?.dur ?? 30;
    const dur = h('select', { name: 'dur' }, ...[...new Set([...durs, want])].sort((a, b) => a - b).map((n) => h('option', { value: String(n), selected: n === want }, n < 120 ? `${n} min` : `${n / 60} h`)));
    const close = () => {
      form = false;
      render();
      plusFocus();
    };
    const f = h(
      'form',
      { className: 'calForm', ariaLabel: edit ? 'Termin ändern' : 'Neuer Termin', noValidate: true }, // own hint instead of the browser's white bubble
      field('Titel', title),
      h(
        'div',
        { className: 'calFormRow' },
        field('Datum', h('input', { type: 'date', name: 'date', required: true, value: edit ? calDayKey(edit.at) : picked })),
        field('Uhrzeit', h('input', { type: 'time', name: 'time', required: true, value: `${calPad(next.getHours())}:${calPad(next.getMinutes())}` })),
        field('Dauer', dur),
      ),
      h('div', { className: 'calFormRow' }, field('Wiederholen', repeat)),
      h('div', { className: 'calFormActions' }, h('button', { type: 'button', className: 'btn', onclick: close }, 'Abbrechen'), h('button', { type: 'submit', className: 'btn primary' }, edit ? 'Speichern' : 'Eintragen')),
    );
    // Escape closes the form, not the island
    f.addEventListener('keydown', (e) => e.key === 'Escape' && (e.stopPropagation(), close()));
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(f);
      const at = new Date(`${fd.get('date')}T${fd.get('time')}`).getTime();
      const text = String(fd.get('title')).trim().slice(0, 80);
      if (!text) {
        title.setAttribute('aria-invalid', 'true');
        title.placeholder = 'Ohne Titel geht es nicht.'; // the red rim alone would say it only in colour
        return title.focus();
      }
      if (!Number.isFinite(at)) return f.querySelector(fd.get('date') ? '[name=time]' : '[name=date]').focus();
      // set within the last 15 min: the user knows already, no reminder
      const rep = CAL_REPEATS[fd.get('repeat')] ? fd.get('repeat') : undefined;
      // an edit at the same time keeps what was announced already (a repeat's start of today); a new time can be reminded again
      const reminded = edit && edit.at === at ? edit.reminded : at - Date.now() <= CAL_REMIND_MS ? at : false;
      const item = { id: edit?.id ?? crypto.randomUUID(), title: text, at, dur: Number(fd.get('dur')) || 30, ...(rep && { repeat: rep }), reminded };
      data.events = edit ? data.events.map((x) => (x === edit ? item : x)) : [...data.events, item];
      // the day shown stays when the appointment still falls on it (an edited repeat), else it goes to the new one
      if (calAt(item, picked) === null) {
        picked = calDayKey(at);
        month = { y: new Date(at).getFullYear(), m: new Date(at).getMonth() };
      }
      save();
      close();
    });
    return f;
  }

  function remind() {
    const now = Date.now();
    const due = calDue(data.events, now);
    for (const e of due) {
      e.src.reminded = e.at;
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
      if (Array.isArray(saved?.events)) data = { events: saved.events.filter(ok).map((e) => (e.repeat && !CAL_REPEATS[e.repeat] ? { ...e, repeat: undefined } : e)) };
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
      const date = (o) => new Date(now).toLocaleDateString(LOCALE, o);
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
