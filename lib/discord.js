// Discord, local RPC over the client's named pipe: who is in the voice channel the user is in. No bot, no server, only the running Discord.
// Frames, the voice list and the client live here; main gives it the pipe and the tokens (sealed with safeStorage).

export const DISCORD_SCOPES = ['rpc', 'rpc.voice.read'];
export const DISCORD_REDIRECT = 'http://127.0.0.1'; // has to be listed under OAuth2 > Redirects of the user's own app
const OP = { HANDSHAKE: 0, FRAME: 1, CLOSE: 2, PING: 3, PONG: 4 };
const PIPES = 10; // discord-ipc-0 to -9, one per running client
const RETRY_MS = 5000;
const RETRY_MAX_MS = 60000;
const CHANNEL_EVENTS = ['VOICE_STATE_CREATE', 'VOICE_STATE_UPDATE', 'VOICE_STATE_DELETE', 'SPEAKING_START', 'SPEAKING_STOP'];

export const pipePath = (n) => `\\\\?\\pipe\\discord-ipc-${n}`;

// op and length as 32-bit little endian, then the JSON
export function encodeFrame(op, body) {
  const json = Buffer.from(JSON.stringify(body));
  const head = Buffer.alloc(8);
  head.writeInt32LE(op, 0);
  head.writeInt32LE(json.length, 4);
  return Buffer.concat([head, json]);
}

// Chunks of the pipe -> whole frames; one frame may come in pieces, several in one chunk. A broken one drops the rest of the buffer.
export function frameReader(onFrame) {
  let buf = Buffer.alloc(0);
  return (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    while (buf.length >= 8) {
      const op = buf.readInt32LE(0);
      const len = buf.readInt32LE(4);
      if (buf.length < 8 + len) return;
      const body = buf.subarray(8, 8 + len);
      buf = buf.subarray(8 + len);
      try {
        onFrame(op, JSON.parse(body.toString('utf8')));
      } catch {
        buf = Buffer.alloc(0);
      }
    }
  };
}

// a voice state of the API -> one person of the list
export function discordPerson(vs) {
  const v = vs.voice_state ?? {};
  return {
    id: vs.user?.id,
    name: vs.nick || vs.user?.global_name || vs.user?.username || '?',
    avatar: vs.user?.avatar ?? null,
    muted: !!(vs.mute || v.mute || v.self_mute),
    deaf: !!(v.deaf || v.self_deaf),
    speaking: false,
  };
}

// the list after one event; pure
export function applyVoice(people, evt, data) {
  const id = data.user_id ?? data.user?.id;
  if (evt === 'VOICE_STATE_DELETE') return people.filter((p) => p.id !== id);
  if (evt === 'SPEAKING_START' || evt === 'SPEAKING_STOP') return people.map((p) => (p.id === id ? { ...p, speaking: evt === 'SPEAKING_START' } : p));
  const next = discordPerson(data);
  const old = people.find((p) => p.id === id);
  return old ? people.map((p) => (p === old ? { ...next, speaking: p.speaking } : p)) : [...people, next];
}

// null for anything but Discord's own id and hash shapes: they end up in a URL
export function avatarUrl(id, hash) {
  return /^\d+$/.test(id ?? '') && /^\w+$/.test(hash ?? '') ? `https://cdn.discordapp.com/avatars/${id}/${hash}.png?size=64` : null;
}

// status: connecting | nodiscord | auth (the user has to allow it in Discord) | nochannel | live
// connect(n): a socket on pipe n · tokens: { get(), exchange(code), refresh(), clear() } · onJoin(name): someone else came in
export function createDiscord({ clientId, connect, tokens, onState, onJoin = () => {}, wait = setTimeout, stopWait = clearTimeout }) {
  let sock = null;
  let stopped = false;
  let delay = RETRY_MS;
  let timer = null;
  let nonce = 0;
  let self = null;
  let channelId = null;
  let queue = Promise.resolve();
  let state = { status: 'connecting', channel: null, people: [], error: null };
  const pending = new Map();
  const put = (change) => onState((state = { ...state, ...change }));

  const request = (cmd, args = {}, evt) =>
    new Promise((resolve, reject) => {
      if (!sock) return reject(new Error('Discord ist nicht verbunden'));
      const id = String(++nonce);
      pending.set(id, { resolve, reject });
      sock.write(encodeFrame(OP.FRAME, { cmd, args, evt, nonce: id }));
    });

  function retry() {
    put({ status: 'nodiscord', channel: null, people: [] });
    timer = wait(() => open(0), delay);
    delay = Math.min(delay * 2, RETRY_MAX_MS);
  }

  function open(n) {
    if (stopped) return;
    if (n >= PIPES) return retry();
    const s = connect(n);
    let up = false;
    s.on('connect', () => {
      up = true;
      sock = s;
      s.write(encodeFrame(OP.HANDSHAKE, { v: 1, client_id: clientId }));
    });
    s.on('data', frameReader((op, msg) => onFrame(s, op, msg)));
    s.on('error', () => !up && open(n + 1));
    s.on('close', () => {
      if (!up || s !== sock) return;
      sock = null;
      channelId = null;
      for (const p of pending.values()) p.reject(new Error('Discord wurde geschlossen'));
      pending.clear();
      if (!stopped) retry();
    });
  }

  function onFrame(s, op, msg) {
    if (op === OP.PING) return s.write(encodeFrame(OP.PONG, msg));
    if (op === OP.CLOSE) return s.destroy();
    if (op !== OP.FRAME) return;
    if (msg.cmd === 'DISPATCH') {
      if (msg.evt === 'READY') {
        delay = RETRY_MS;
        self = msg.data?.user?.id ?? null;
        return void login();
      }
      if (msg.evt === 'VOICE_CHANNEL_SELECT') return void (queue = queue.then(selected, selected));
      if (CHANNEL_EVENTS.includes(msg.evt)) return voice(msg.evt, msg.data);
      return;
    }
    const p = pending.get(msg.nonce);
    if (!p) return;
    pending.delete(msg.nonce);
    if (msg.evt === 'ERROR') p.reject(Object.assign(new Error(msg.data?.message ?? 'Discord-Fehler'), { code: msg.data?.code }));
    else p.resolve(msg.data);
  }

  function voice(evt, data) {
    const id = data?.user?.id ?? data?.user_id;
    if (!id) return;
    const known = state.people.some((p) => p.id === id);
    put({ people: applyVoice(state.people, evt, data) });
    if (evt === 'VOICE_STATE_CREATE' && !known && id !== self) onJoin(discordPerson(data).name);
  }

  // No token: wait for the user. The dialog in Discord only ever comes from authorize(), never from a reconnect.
  async function login() {
    let token = tokens.get();
    if (!token) return put({ status: 'auth' });
    try {
      await request('AUTHENTICATE', { access_token: token });
    } catch {
      try {
        token = await tokens.refresh();
        await request('AUTHENTICATE', { access_token: token });
      } catch {
        tokens.clear();
        return put({ status: 'auth' });
      }
    }
    put({ error: null });
    try {
      await request('SUBSCRIBE', {}, 'VOICE_CHANNEL_SELECT');
      await (queue = queue.then(selected, selected));
    } catch (e) {
      put({ status: 'auth', error: e.message });
    }
  }

  async function leave() {
    const id = channelId;
    channelId = null;
    if (id) await Promise.all(CHANNEL_EVENTS.map((evt) => request('UNSUBSCRIBE', { channel_id: id }, evt).catch(() => {})));
  }

  async function selected() {
    const ch = await request('GET_SELECTED_VOICE_CHANNEL');
    await leave();
    if (!ch) return put({ status: 'nochannel', channel: null, people: [] });
    channelId = ch.id;
    await Promise.all(CHANNEL_EVENTS.map((evt) => request('SUBSCRIBE', { channel_id: ch.id }, evt)));
    const guild = ch.guild_id ? await request('GET_GUILD', { guild_id: ch.guild_id, timeout: 5000 }).catch(() => null) : null;
    put({ status: 'live', channel: { name: ch.name || 'Anruf', guild: guild?.name ?? null }, people: (ch.voice_states ?? []).map(discordPerson) });
  }

  open(0);
  return {
    // the user pressed the button: the dialog in Discord, then the code becomes tokens
    async authorize() {
      put({ error: null });
      try {
        const { code } = await request('AUTHORIZE', { client_id: clientId, scopes: DISCORD_SCOPES });
        await tokens.exchange(code);
        await login();
      } catch (e) {
        put({ status: 'auth', error: e.message });
      }
    },
    stop() {
      stopped = true;
      stopWait(timer);
      sock?.destroy();
      sock = null;
    },
  };
}
