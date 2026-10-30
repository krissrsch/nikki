// Discord (notes/plan/discord.plan.md): who is in the voice channel the user is in. main talks to the running Discord (lib/discord.js) and sends the whole state.
// State: { status: off | setup | connecting | nodiscord | auth | nochannel | live, channel: { name, guild } | null, people: [{ id, name, avatar, muted, deaf, speaking }], error }

// ---- pure, tested in modules.test.js
const DISCORD_EMPTY = {
  off: ['Discord ist aus.'],
  setup: ['Discord ist noch nicht verbunden.', 'Trag in den Einstellungen deine Discord-App ein.'],
  connecting: ['Nikki verbindet sich …'],
  nodiscord: ['Discord läuft nicht.', 'Sobald es offen ist, verbindet sich Nikki von selbst.'],
  auth: ['Freigabe nötig.', 'Bestätige Nikki einmal in Discord.'],
  nochannel: ['Du bist in keinem Sprachkanal.', 'Hier stehen dann alle, die mit dir drin sind.'],
};
// the Discord mark, filled inside the stroked .ti icons; settings.js uses it too
const DISCORD_MARK = '<path fill="currentColor" stroke="none" d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" />';
function discordCount(n) {
  return n === 1 ? '1 Person' : `${n} Personen`;
}

(() => {
  const api = globalThis.companion; // undefined in the unit test sandbox
  const ICON = `<svg class="ti" viewBox="0 0 24 24" aria-hidden="true">${DISCORD_MARK}</svg>`;
  const MUTED = '<svg class="ti" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM6 11a6 6 0 0 0 12 0M12 17v4M4 4l16 16" /></svg>';
  const DEAF = '<svg class="ti" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 14v-2a8 8 0 0 1 16 0v2M4 4l16 16" /><rect x="3" y="14" width="4" height="6" rx="1.5" /><rect x="17" y="14" width="4" height="6" rx="1.5" /></svg>';
  const stateIcon = (label, svg) => h('span', { className: 'dcState', title: label, ariaLabel: label, role: 'img', innerHTML: svg });
  let now = { status: 'off', channel: null, people: [], error: null };
  let ctx = null;
  let root = null;

  const avatar = (p) =>
    h('span', { className: `dcAvatar${p.speaking ? ' talk' : ''}` }, p.avatar ? h('img', { src: p.avatar, alt: '' }) : p.name.slice(0, 1).toUpperCase());

  function empty() {
    const [title, sub] = DISCORD_EMPTY[now.status] ?? DISCORD_EMPTY.off;
    const action =
      now.status === 'setup'
        ? h('button', { type: 'button', className: 'btn', onclick: () => api.openSettings('discord') }, 'Einstellungen öffnen')
        : now.status === 'auth' && h('button', { type: 'button', className: 'btn', onclick: () => api.discordAuthorize() }, 'In Discord freigeben');
    return h('div', { className: 'dcEmpty' }, h('strong', {}, title), sub && h('p', { className: 'meta' }, sub), now.error && h('p', { className: 'meta bad' }, now.error), action);
  }

  function render() {
    if (!root || !ctx?.shown()) return;
    if (now.status !== 'live') return root.replaceChildren(empty());
    root.replaceChildren(
      h('div', { className: 'dcHead' }, h('strong', {}, now.channel.name), h('span', { className: 'meta' }, [now.channel.guild, discordCount(now.people.length)].filter(Boolean).join(' · '))),
      h('div', { className: 'dcList' }, ...now.people.map((p) =>
        h('div', { className: 'dcRow' }, avatar(p), h('span', { className: 'dcName', title: p.name }, p.name), p.deaf ? stateIcon('taub', DEAF) : p.muted && stateIcon('stumm', MUTED)),
      )),
    );
  }

  api?.onDiscord((state) => {
    now = state;
    render();
    ctx?.changed();
  });

  registerModule({
    id: 'discord',
    title: 'Discord',
    icon: ICON,
    async start(c) {
      ctx = c;
      now = (await api?.discordGet()) ?? now;
    },
    stop() {
      ctx = root = null;
    },
    page(el) {
      root = el;
      render();
    },
    tile(el) {
      const live = now.status === 'live';
      el.append(
        h('div', { className: 'tileHead', innerHTML: ICON.replace('"ti"', '"hi"') }, 'Discord'),
        h('p', { className: 'dcTileText' }, live ? [now.channel.name, discordCount(now.people.length)].join(' · ') : (DISCORD_EMPTY[now.status] ?? DISCORD_EMPTY.off)[0]),
        h('div', { className: 'dcStack' }, ...(live ? now.people.slice(0, 5).map(avatar) : [])),
      );
    },
  });
})();
