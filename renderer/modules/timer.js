// Timer (plan 3.7): Pomodoro 5/15/25 min or an own length (1-180). Runs on while the island is closed; chime and toast at the end.
// Data: { preset (min), endsAt: ts while it runs | null, left: ms while paused | null, rounds: { day, n } focus rounds done that day }

// ---- pure, tested in modules.test.js
function timerLeft(t, now) {
  return t.endsAt ? Math.max(0, t.endsAt - now) : t.left ?? t.preset * 60000;
}
// focus rounds done today; the count of another day is over
const timerDay = (ts) => new Date(ts).toDateString();
const timerRounds = (rounds, now) => (rounds?.day === timerDay(now) ? rounds.n : 0);
function timerMinutes(v) {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(180, Math.max(1, n)) : 25;
}
function timerText(ms) {
  const s = Math.ceil(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

(() => {
  const PRESETS = [5, 15, 25];
  const RING = 2 * Math.PI * 62; // circumference of the 140 ring (r 62, stroke 8)
  let t = { preset: 25, endsAt: null, left: null };
  let rounds = null; // { day, n }
  let ctx;
  let root;
  let tick;
  const label = () => ({ 5: 'Kurze Pause', 15: 'Lange Pause' })[t.preset] ?? 'Fokus';
  const save = () => (ctx.save({ ...t, rounds }), ctx.changed());
  const countRound = (now) => (rounds = { day: timerDay(now), n: timerRounds(rounds, now) + 1 });
  const goLabel = () => (t.endsAt ? 'Pause' : t.left ? 'Fortsetzen' : 'Start');
  const run = () => {
    clearInterval(tick);
    tick = t.endsAt ? setInterval(step, 1000) : null;
  };
  function toggle() {
    const now = Date.now();
    t = t.endsAt ? { ...t, endsAt: null, left: timerLeft(t, now) } : { ...t, endsAt: now + timerLeft(t, now), left: null };
    run();
    save();
    render();
  }
  function reset(preset = t.preset) {
    t = { preset, endsAt: null, left: null };
    run();
    save();
    render();
  }
  // every second while it runs: the numbers and the ring; at zero chime and toast
  function step() {
    if (timerLeft(t, Date.now()) > 0) return paint();
    const focus = label() === 'Fokus';
    if (focus) countRound(Date.now());
    reset();
    ctx.chime('done');
    ctx.toast(focus ? 'Fokuszeit ist um. Gönn dir eine Pause.' : 'Pause ist vorbei. Weiter geht’s!');
  }
  function paint() {
    const left = timerLeft(t, Date.now());
    for (const el of document.querySelectorAll('.timerText')) el.textContent = timerText(left);
    root?.querySelector('.timerArc')?.setAttribute('stroke-dashoffset', String(RING * (1 - left / (t.preset * 60000))));
    root?.querySelector('.timerRing svg')?.setAttribute('aria-label', `${label()}-Timer, noch ${Math.ceil(left / 60000)} Minuten`);
  }

  function render() {
    if (!root) return;
    const busy = Boolean(t.endsAt || t.left); // a round is on: a mis-click on a preset must not throw it away
    // an own length: type the minutes, Enter or leaving the field takes them
    const input = h('input', { type: 'number', className: 'timerOwn', min: 1, max: 180, step: 1, value: PRESETS.includes(t.preset) ? '' : String(t.preset), placeholder: 'eigene', disabled: busy, ariaLabel: 'Eigene Dauer in Minuten' });
    input.addEventListener('change', () => input.value && reset(timerMinutes(input.value)));
    const own = h('label', { className: `timerOwnBox${PRESETS.includes(t.preset) ? '' : ' on'}`, title: busy ? 'Erst zurücksetzen' : 'Eigene Dauer in Minuten' }, input, h('span', {}, 'min'));
    const n = timerRounds(rounds, Date.now());
    const ring = h('div', {
      className: 'timerRing',
      innerHTML: `<svg viewBox="0 0 140 140" role="img"><circle class="timerTrack" cx="70" cy="70" r="62"/><circle class="timerArc" cx="70" cy="70" r="62" stroke-dasharray="${RING}" transform="rotate(-90 70 70)"/><text class="timerText" x="70" y="79" text-anchor="middle"></text></svg>`,
    });
    root.replaceChildren(
      h(
        'div',
        { className: 'timerPage' },
        ring,
        h(
          'div',
          { className: 'timerSide' },
          h('span', { className: 'timerLabel' }, label()),
          h(
            'div',
            { className: 'timerPresets', role: 'group', ariaLabel: 'Dauer' },
            ...PRESETS.map((m) => h('button', { type: 'button', className: 'btn', ariaPressed: String(m === t.preset), disabled: busy, title: busy ? 'Erst zurücksetzen' : '', onclick: () => reset(m) }, `${m} min`)),
            own,
          ),
          h('span', { className: 'timerRounds' }, n ? `Heute ${n} ${n === 1 ? 'Fokusrunde' : 'Fokusrunden'}` : 'Heute noch keine Fokusrunde'),
          h('div', { className: 'timerActions' }, h('button', { type: 'button', className: 'btn primary', onclick: toggle }, goLabel()), h('button', { type: 'button', className: 'btn', onclick: () => reset() }, 'Zurücksetzen')),
        ),
      ),
    );
    paint();
  }

  registerModule({
    id: 'timer',
    title: 'Timer',
    icon: '<svg class="ti" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2 2M9 2h6" /></svg>',
    async start(c) {
      ctx = c;
      const saved = await c.load();
      if (saved?.rounds && Number.isInteger(saved.rounds.n)) rounds = { day: String(saved.rounds.day), n: saved.rounds.n };
      if (saved && Number.isInteger(saved.preset) && saved.preset >= 1 && saved.preset <= 180) {
        t = { preset: saved.preset, endsAt: Number(saved.endsAt) || null, left: Number(saved.left) || null };
        if (t.endsAt && t.endsAt <= Date.now()) {
          // ran out while Nikki was closed: a focus round still counts, on the day it ended
          if (label() === 'Fokus') rounds = { day: timerDay(t.endsAt), n: timerRounds(rounds, t.endsAt) + 1 };
          t = { preset: t.preset, endsAt: null, left: null };
        }
      }
      run();
    },
    stop() {
      clearInterval(tick);
      root = null;
    },
    page(el) {
      root = el;
      render();
    },
  });
})();
