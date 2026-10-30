// Timer (plan 3.7): Pomodoro 5/15/25 min. Runs on while the island is closed; chime and toast at the end.
// Data: { preset (min), endsAt: ts while it runs | null, left: ms while paused | null }

// ---- pure, tested in modules.test.js
function timerLeft(t, now) {
  return t.endsAt ? Math.max(0, t.endsAt - now) : t.left ?? t.preset * 60000;
}
function timerText(ms) {
  const s = Math.ceil(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

(() => {
  const PRESETS = [5, 15, 25];
  const RING = 2 * Math.PI * 62; // circumference of the 140 ring (r 62, stroke 8)
  let t = { preset: 25, endsAt: null, left: null };
  let ctx;
  let root;
  let tick;
  const label = () => ({ 5: 'Kurze Pause', 15: 'Lange Pause' })[t.preset] ?? 'Fokus';
  const save = () => (ctx.save(t), ctx.changed());
  const goLabel = () => (t.endsAt ? 'Pause' : t.left ? 'Weiter' : 'Start');
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
          h('div', { className: 'timerPresets', role: 'group', ariaLabel: 'Dauer' }, ...PRESETS.map((m) => h('button', { type: 'button', className: 'btn', ariaPressed: String(m === t.preset), onclick: () => reset(m) }, `${m} min`))),
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
      if (saved && PRESETS.includes(saved.preset)) {
        t = { preset: saved.preset, endsAt: Number(saved.endsAt) || null, left: Number(saved.left) || null };
        if (t.endsAt && t.endsAt <= Date.now()) t = { preset: t.preset, endsAt: null, left: null }; // ran out while Nikki was closed
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
