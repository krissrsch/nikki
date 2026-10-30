// Musik (plan 3.2): what Windows plays (SMTC through helper/NikkiHelper.exe, which main runs while this module is on).
// Page: cover, title, artist · app, progress, back/play/next, volume. Tile: cover, title, progress, play.
// Closed notch: while something plays, Nikki's eyes dance and the glow shows its music edge.
// No data of its own: main sends media and volume as they change (null: nothing plays, or no helper).

// ---- pure, tested in modules.test.js
// seconds played now: the helper's snapshot from updatedAt, run on while playing, never past the end
function musicPos(m, now) {
  const run = m.status === 'playing' && m.updatedAt > 0 ? (now - m.updatedAt) / 1000 : 0;
  const pos = Math.max(0, (m.position || 0) + run);
  return m.duration > 0 ? Math.min(m.duration, pos) : pos;
}
// 0:07, 3:40, 1:02:03
function musicTime(sec) {
  const s = Math.floor(Math.max(0, sec));
  const two = (n) => String(n).padStart(2, '0');
  return s >= 3600 ? `${Math.floor(s / 3600)}:${two(Math.floor(s / 60) % 60)}:${two(s % 60)}` : `${Math.floor(s / 60)}:${two(s % 60)}`;
}
// "Spotify.exe" → Spotify, "SpotifyAB.SpotifyMusic_zpdnekdrzrea0!Spotify" → Spotify, "MSEdge" → Edge, else the last part without .exe
function musicApp(id) {
  const raw = String(id ?? '');
  const known = [['spotify', 'Spotify'], ['msedge', 'Edge'], ['chrome', 'Chrome'], ['firefox', 'Firefox'], ['zunemusic', 'Medienwiedergabe'], ['vlc', 'VLC']];
  return known.find(([k]) => raw.toLowerCase().includes(k))?.[1] ?? raw.split(/[!\\]/).pop().replace(/\.exe$/i, '');
}

(() => {
  const api = globalThis.companion; // undefined in the unit test sandbox
  const ICON = (d, cls = 'mi') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;
  const ICON_PLAY = ICON('M7 4v16l13-8z');
  const ICON_PAUSE = ICON('M6 5h4v14H6zM14 5h4v14h-4z');
  const ICON_PREV = ICON('M6 5h2v14H6zM20 5v14L9 12z');
  const ICON_NEXT = ICON('M16 5h2v14h-2zM4 5v14l11-7z');
  const ICON_NOTE = '<svg class="ti" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>';
  const ICON_VOL = '<svg class="ti" viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4V5z" /><path d="M15.5 8.5a5 5 0 0 1 0 7" /></svg>';
  const ICON_MUTED = '<svg class="ti" viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4V5z" /><path d="m16 9 5 5M21 9l-5 5" /></svg>';
  let media = null;
  let vol = null;
  let ownVolAt = 0; // our own slider: incoming levels do not fight the drag
  let ctx;
  let root;
  let tick;
  const playing = () => media?.status === 'playing';
  const send = (cmd, value) => api.media(cmd, value);
  const run = () => {
    clearInterval(tick);
    tick = ctx && playing() ? setInterval(paint, 1000) : null;
  };

  const cover = (cls) =>
    media?.cover ? h('img', { className: cls, src: media.cover, alt: '' }) : h('span', { className: `${cls} none`, innerHTML: ICON_NOTE });
  const round = (label, icon, cls, onclick) => h('button', { type: 'button', className: `mBtn ${cls}`, ariaLabel: label, title: label, innerHTML: icon, onclick });
  const playBtn = (cls) => round(playing() ? 'Pause' : 'Abspielen', playing() ? ICON_PAUSE : ICON_PLAY, `play ${cls}`, () => send('toggle'));
  const track = (cls = '') => h('span', { className: `musicTrack ${cls}` }, h('span', { className: 'musicFill' }));
  function volume() {
    if (!vol) return null;
    const range = h('input', { type: 'range', className: 'musicVol', min: 0, max: 100, step: 1, value: vol.level, ariaLabel: 'Lautstärke' });
    range.addEventListener('input', () => {
      ownVolAt = Date.now();
      send('volume', Number(range.value));
    });
    const mute = round('', '', 'mute', () => {
      ownVolAt = Date.now();
      send(vol.muted ? 'unmute' : 'mute');
    });
    return h('div', { className: 'musicVolume' }, mute, range);
  }
  // volume follows the system without a new page: the slider may be in the middle of a drag
  function paintVolume() {
    for (const el of document.querySelectorAll('.musicVolume')) {
      const [mute, range] = el.children;
      mute.innerHTML = vol.muted ? ICON_MUTED : ICON_VOL;
      mute.ariaLabel = mute.title = vol.muted ? 'Ton an' : 'Stumm schalten';
      mute.ariaPressed = String(vol.muted);
      range.classList.toggle('muted', vol.muted);
      if (Date.now() - ownVolAt > 1500) range.value = vol.level;
    }
  }
  // progress and time, every second while it plays: page and tile
  function paint() {
    if (!media) return;
    const pos = musicPos(media, Date.now());
    const share = media.duration > 0 ? `${(pos / media.duration) * 100}%` : '0%';
    for (const el of document.querySelectorAll('.musicFill')) el.style.width = share;
    for (const el of document.querySelectorAll('.musicNow')) el.textContent = musicTime(pos);
  }

  function render() {
    if (!root) return;
    const sub = media && [media.artist, musicApp(media.app)].filter(Boolean).join(' · ');
    root.replaceChildren(
      media
        ? h(
            'div',
            { className: 'musicPage' },
            cover('musicCover'),
            h(
              'div',
              { className: 'musicMain' },
              h('div', { className: 'musicHead' }, h('span', { className: 'musicTitle', title: media.title }, media.title || 'Ohne Titel'), h('span', { className: 'musicSub', title: sub }, sub)),
              media.duration > 0 && h('div', { className: 'musicBar' }, h('span', { className: 'musicNow' }), track(), h('span', {}, musicTime(media.duration))),
              h('div', { className: 'musicCtrl' }, round('Zurück', ICON_PREV, '', () => send('prev')), playBtn(''), round('Weiter', ICON_NEXT, '', () => send('next')), h('span', { className: 'grow' }), volume()),
            ),
          )
        : h(
            'div',
            { className: 'musicEmpty' },
            h('span', { className: 'musicCover small none', innerHTML: ICON_NOTE }),
            h('div', { className: 'musicHead' }, h('span', { className: 'musicTitle' }, 'Gerade läuft nichts'), h('span', { className: 'musicSub' }, 'Starte Musik in Spotify, im Browser oder einer anderen App. Nikki tanzt dann mit.')),
            volume(),
          ),
    );
    paint();
    if (vol) paintVolume();
  }

  // what the page and tile show; players send a fresh position snapshot every few seconds, which only moves the bar
  const SHOWN = ['title', 'artist', 'app', 'status', 'duration', 'cover'];
  // subscribed once: switching the module off and on must not add listeners
  api?.onMedia((m) => {
    const same = !!media === !!m && SHOWN.every((k) => media?.[k] === m?.[k]);
    media = m;
    if (!ctx) return;
    run();
    if (same) return paint(); // a new page would take the keyboard focus away every few seconds
    render();
    ctx.changed();
  });
  api?.onVolume((v) => {
    const before = vol;
    vol = v;
    if (!ctx) return;
    if (!before || !v) return render(); // the slider comes or goes
    paintVolume();
  });

  registerModule({
    id: 'music',
    title: 'Musik',
    icon: `<svg class="ti" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>`,
    async start(c) {
      ctx = c;
      ({ media, volume: vol } = (await api?.mediaGet()) ?? { media: null, volume: null });
      run();
    },
    stop() {
      clearInterval(tick);
      ctx = root = null;
    },
    page(el) {
      root = el;
      render();
    },
    tile(el, c) {
      if (!media) {
        el.append(c.head(), h('span', { className: 'tileBig' }, 'Gerade still'), h('span', { className: 'tileSub' }, 'Starte Musik, Nikki tanzt mit.'));
        return;
      }
      el.append(
        c.head(musicApp(media.app)),
        h('div', { className: 'musicRow' }, cover('musicCover mini'), h('span', { className: 'tileStack' }, h('span', { className: 'musicTileTitle', title: media.title }, media.title || 'Ohne Titel'), h('span', { className: 'tileSub' }, media.artist))),
        h('div', { className: 'musicRow' }, track('thin'), playBtn('small')),
      );
      paint();
    },
    glance: () => ({ music: { playing: playing() } }),
  });
})();
