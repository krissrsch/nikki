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
function discordCount(n) {
  return n === 1 ? '1 Person' : `${n} Personen`;
}

(() => {
  const api = globalThis.companion; // undefined in the unit test sandbox
  const ICON = '<svg class="ti" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 14v-2a8 8 0 0 1 16 0v2" /><rect x="3" y="14" width="4" height="6" rx="1.5" /><rect x="17" y="14" width="4" height="6" rx="1.5" /></svg>';
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
        h('div', { className: 'dcRow' }, avatar(p), h('span', { className: 'dcName', title: p.name }, p.name), p.deaf ? h('span', { className: 'dcState' }, 'taub') : p.muted && h('span', { className: 'dcState' }, 'stumm')),
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
