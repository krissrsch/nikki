const $ = (id) => document.getElementById(id);
const api = window.companion;
const island = $('island');
const answer = $('answer');
const go = $('go');
const promptEl = $('prompt');
const menu = $('projectMenu');
const STEP_IDLE = 'Nikki wartet…';

let busy = false;
let open = false;
let perms = [];
let projects = [];
let current = null; // selected project folder
let newSession = false;
let plan = false;
let model = null; // null = the CLI's default model
let models = {}; // per project: model id (older state: { claude, … })
const MODELS = [
  [null, 'Standard'],
  ['opus', 'Opus'],
  ['sonnet', 'Sonnet'],
  ['haiku', 'Haiku'],
];
function modelOf(cwd) {
  const m = models[cwd];
  return (m && typeof m === 'object' ? m.claude : m) ?? null;
}
const modelLabel = (v = model) => MODELS.find(([id]) => id === v)?.[1] ?? (v || 'Standard');
let claudeFound = true;
let muted = false;
let sleepMin = 5; // settings: minutes until Nikki falls asleep in the notch
let showBranch = true;
let settings = {};
let terminal = []; // Claude Code sessions started in a terminal, reported by hooks
let focusSession = null; // observed session id pinned by tapping a session pill
let unseen = null; // 'done' | 'error' of our own task, until the chat was looked at
let lastActivity = Date.now();
let hover = false; // pointer over the island: Nikki wakes up
let buddies = []; // Home Nikki; state syncs to it
const buddyEmit = (fn, ...args) => buddies.forEach((b) => b[fn]?.(...args));
const modelMenu = $('modelMenu');
const chatsMenu = $('chatsMenu');
const threadEl = $('thread');
const MAX_SESSION_PILLS = 2;
let chatId = null;
let chatTitle = null; // custom name; null = derive from first user message
let chatMessages = []; // { role, text, at }[]
let chatsCache = [];
let lastChatId = null;
let chatCwd = null; // project the open chat belongs to; its session only resumes there
async function rememberLastChat(id) {
  lastChatId = id || null;
  await api.setLastChat?.(lastChatId);
}
let view = 'home';
const VIEWS = { home: 'viewHome', chat: 'viewChat', settings: 'viewSettings' }; // + one per module switched on

function setView(name) {
  // Permission card lives in Chat — never leave it while a prompt is waiting
  view = perms.length ? 'chat' : VIEWS[name] ? name : 'home';
  document.body.dataset.view = view;
  for (const [v, id] of Object.entries(VIEWS)) $(id).hidden = v !== view;
  for (const btn of document.querySelectorAll('#tabs .tab')) {
    btn.setAttribute('aria-pressed', String(btn.dataset.view === view));
  }
  if (view === 'chat' && open && !perms.length) promptEl.focus(); // a waiting card keeps the keyboard (its hotkeys)
  if (view === 'settings') api.settingsGet().then(applySettings); // autostart or the Claude path may have changed outside
  if (view === 'home') for (const id of live.keys()) renderTile(id); // "in 12 min" and co. are as old as the last look
  if (live.has(view)) NikkiModules.get(view).page($(VIEWS[view]), live.get(view));
  renderState();
}

const STATE_LABEL = { needsYou: 'braucht dich', working: 'arbeitet', thinking: 'denkt', done: 'fertig', error: 'Fehler', idle: 'wartet' };
// a finished or failed task counts until the chat was looked at; then our own session just waits
const ownState = () => (['done', 'error'].includes(lastStatus.state) && !unseen ? 'idle' : lastStatus.state);
function sessionDot(state) {
  const d = document.createElement('span');
  d.className = 'sDot';
  d.dataset.state = state;
  return d;
}

// Home "Heute": greeting + the Claude tile (status only; the chat lives in its own tab)
function renderHome() {
  const now = new Date();
  const h = now.getHours();
  $('greet').textContent = h < 11 ? 'Guten Morgen' : h < 18 ? 'Guten Tag' : 'Guten Abend';
  $('today').textContent = now.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
  const rows = [
    ...(current ? [{ name: folderName(current), state: ownState(), title: current }] : []),
    ...[...terminal]
      .sort((a, b) => (RANK[b.state] || 0) - (RANK[a.state] || 0) || b.at - a.at)
      .map((t) => ({ name: `${folderName(t.cwd)} · Terminal`, state: t.state || 'idle', title: t.cwd })),
  ];
  $('claudeMeta').textContent = rows.length === 1 ? '1 Session' : `${rows.length} Sessions`;
  const nodes = rows.slice(0, 3).map((r) => {
    const row = document.createElement('div');
    row.className = 'sRow';
    row.title = r.title;
    const name = document.createElement('span');
    name.className = 'sName';
    name.textContent = r.name;
    const state = document.createElement('span');
    state.className = 'sState';
    state.dataset.state = r.state;
    state.textContent = STATE_LABEL[r.state] ?? r.state;
    row.append(sessionDot(r.state), name, state);
    return row;
  });
  if (!nodes.length) {
    const empty = document.createElement('p');
    empty.className = 'tileHint';
    empty.textContent = 'Noch kein Projekt. Im Chat wählst du eins.';
    nodes.push(empty);
  }
  $('claudeSessions').replaceChildren(...nodes);
}

const folderName = (p) => {
  const s = String(p ?? '').trim();
  if (!s) return 'Projekt';
  return s.split(/[\\/]/).filter(Boolean).pop() ?? s;
};
const svg = (path) => `<svg class="icon" viewBox="0 0 16 16" aria-hidden="true"><path d="${path}"/></svg>`;
const ICON_FOLDER = svg('M2.5 4.5h4l1.5 1.5h5.5v6.5h-11z');

// ---- click-through: the window only catches the mouse over .hit elements
let through = true;
function setThrough(on) {
  if (on === through) return;
  through = on;
  api.setClickThrough(on);
}
addEventListener('mousemove', (e) => setThrough(!e.target.closest?.('.hit')));
document.addEventListener('mouseleave', () => setThrough(true));

// ---- status + steps
let lastStatus = { state: 'idle', text: 'Nikki wartet…' };
let chatSessionId = null; // ACP/CLI session bound to the open chat
let turnFinalized = false;
const RANK = { needsYou: 3, working: 2, thinking: 2, done: 1 }; // done briefly owns the island for chime/status
// our own task comes first; while it rests, a focused or most urgent observed session gets the island
function shown() {
  const p = perms[0];
  if (p?.origin === 'terminal' && !busy) return { state: 'needsYou', text: `${folderName(p.cwd)}: ${p.toolName === 'AskUserQuestion' ? 'Frage' : p.toolName === 'ExitPlanMode' ? 'Plan' : 'Freigabe'}`, cwd: p.cwd, observed: true };
  if (busy || perms.length) return lastStatus;
  // folder lives on the session pill — don't repeat it in the status text
  if (focusSession) {
    const pinned = terminal.find((x) => x.id === focusSession);
    if (pinned) return { state: pinned.state, text: pinned.text, cwd: pinned.cwd, observed: true };
  }
  const t = terminal.filter((x) => RANK[x.state]).sort((a, b) => RANK[b.state] - RANK[a.state])[0];
  return t ? { state: t.state, text: t.text, cwd: t.cwd, observed: true } : lastStatus;
}
let shownState;
function renderState() {
  const s = shown();
  document.body.dataset.state = s.state;
  if (s.state !== shownState) buddyEmit('setState', s.state);
  shownState = s.state;
  if (open && view === 'chat') unseen = null; // looked at
  renderHome();
  renderGlance();
  renderChatDot();
  renderSessionPills();
}

// ---- closed notch: glance() (glance.js) ranks what shows; this only paints it
const MOOD_LABEL = { sleep: 'Nikki schläft', awake: 'Nikki ist wach', work: 'Nikki schaut zu', need: 'Nikki braucht dich', done: 'Nikki ist zufrieden', music: 'Nikki tanzt zur Musik' };
const GLANCE_ICON = {
  check: '<svg class="gi" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5L20 7" /></svg>',
  calendar: '<svg class="gi" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>',
  volume: '<svg class="gi" viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4V5z" /><path d="M15.5 8.5a5 5 0 0 1 0 7" /></svg>',
  file: '<svg class="gi" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3H6v18h12V7z" /><path d="M14 3v4h4" /></svg>',
  timer: '<svg class="gi" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2 2M9 2h6" /></svg>',
};
function glanceSide(el, info) {
  el.className = `side${info?.tone ? ` ${info.tone}` : ''}`;
  el.title = info?.text ?? '';
  el.replaceChildren();
  if (!info) return;
  const part = (cls) => el.appendChild(Object.assign(document.createElement('span'), { className: cls }));
  if (info.icon === 'dot' || info.icon === 'spin') part(`g-${info.icon}`);
  if (info.icon === 'cover' || info.icon === 'music') {
    const c = part('g-cover');
    if (info.cover) c.style.backgroundImage = `url("${info.cover}")`;
  }
  if (GLANCE_ICON[info.icon]) el.insertAdjacentHTML('beforeend', GLANCE_ICON[info.icon]);
  if (info.icon === 'viz' || info.icon === 'music') for (let i = 0; i < (info.icon === 'viz' ? 4 : 3); i++) part('g-bar');
  if (info.icon === 'level') part('g-level').appendChild(document.createElement('span')).style.width = `${Math.round((info.level ?? 0) * 100)}%`;
  if (info.text) part('g-text').textContent = info.text;
}
let glanceKey = '';
function renderGlance() {
  const s = shown();
  const cmd = perms[0]?.input?.command; // own approval: the command says more than "Nikki will OK!"
  const cwd = s.observed ? s.cwd : current;
  const fromModules = {}; // { event } from the calendar, { timer } from the timer
  for (const [id, ctx] of live) Object.assign(fromModules, NikkiModules.get(id).glance?.(ctx));
  const g = glance({
    ...fromModules,
    status: s.observed ? s.state : ownState(),
    text: cmd ? `${String(cmd).split('\n')[0]}?` : s.text,
    project: cwd ? folderName(cwd) : '',
    lastActivity,
    hover,
    sleepMin,
  });
  const key = JSON.stringify(g);
  if (key === glanceKey) return;
  glanceKey = key;
  island.dataset.mood = g.mood;
  island.classList.toggle('wide', g.wide);
  glanceSide($('glanceL'), g.left);
  glanceSide($('glanceR'), g.right);
  $('notch').setAttribute('aria-label', [MOOD_LABEL[g.mood], g.left?.text, g.right?.text].filter(Boolean).join(', '));
}
setInterval(renderGlance, 10 * 1000); // falling asleep needs no event
const touch = () => (lastActivity = Date.now());

// ---- chat tab dot: yellow needs you, red error, green done / new answer
const DOT_LABEL = { warn: 'Claude braucht dich', bad: 'Fehler', accent: 'neue Antwort' };
function renderChatDot() {
  const needsYou = !!perms.length || lastStatus.state === 'needsYou' || terminal.some((t) => t.state === 'needsYou');
  const tone = chatDot({ needsYou, unseen, terminalDone: terminal.some((t) => t.state === 'done') });
  const dot = $('chatDot');
  dot.hidden = !tone;
  dot.dataset.tone = tone ?? '';
  dot.parentElement.setAttribute('aria-label', tone ? `Chat, ${DOT_LABEL[tone]}` : 'Chat');
}

// ---- sounds: synthesized in-app (no files, no Windows system sounds)
let audio;
function ensureAudio() {
  audio ??= new AudioContext();
  audio.resume();
  return audio;
}
function chime(kind) {
  if (muted) return;
  const ctx = ensureAudio();
  (kind === 'needsYou' ? [880, 660] : [660, 990]).forEach((freq, i) => {
    const t = ctx.currentTime + i * 0.12;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.18, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.4);
  });
}
/** Soft cat meow (Web Audio — no files). Used for spawn + poke. */
function meow() {
  if (muted) return;
  const ctx = ensureAudio();
  const t = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.0001, t);
  master.gain.exponentialRampToValueAtTime(0.22, t + 0.04);
  master.gain.exponentialRampToValueAtTime(0.12, t + 0.18);
  master.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
  master.connect(ctx.destination);

  const filt = ctx.createBiquadFilter();
  filt.type = 'bandpass';
  filt.Q.value = 2.2;
  filt.frequency.setValueAtTime(900, t);
  filt.frequency.exponentialRampToValueAtTime(1600, t + 0.08);
  filt.frequency.exponentialRampToValueAtTime(520, t + 0.48);
  filt.connect(master);

  // body tone: “mrr” → “yew”
  const body = ctx.createOscillator();
  body.type = 'triangle';
  body.frequency.setValueAtTime(620, t);
  body.frequency.exponentialRampToValueAtTime(1100, t + 0.09);
  body.frequency.exponentialRampToValueAtTime(380, t + 0.5);
  const bodyG = ctx.createGain();
  bodyG.gain.value = 0.7;
  body.connect(bodyG).connect(filt);

  // soft upper partial (less buzz than sawtooth)
  const air = ctx.createOscillator();
  air.type = 'sine';
  air.frequency.setValueAtTime(1240, t);
  air.frequency.exponentialRampToValueAtTime(1980, t + 0.09);
  air.frequency.exponentialRampToValueAtTime(700, t + 0.5);
  const airG = ctx.createGain();
  airG.gain.value = 0.22;
  air.connect(airG).connect(filt);

  // tiny noise rasp so it reads as a mouth, not a beep
  const nLen = Math.max(1, Math.floor(ctx.sampleRate * 0.55));
  const nBuf = ctx.createBuffer(1, nLen, ctx.sampleRate);
  const nData = nBuf.getChannelData(0);
  for (let i = 0; i < nLen; i++) nData[i] = (Math.random() * 2 - 1) * (1 - i / nLen);
  const noise = ctx.createBufferSource();
  noise.buffer = nBuf;
  const nFilt = ctx.createBiquadFilter();
  nFilt.type = 'bandpass';
  nFilt.frequency.value = 1400;
  nFilt.Q.value = 1.2;
  const nG = ctx.createGain();
  nG.gain.setValueAtTime(0.0001, t);
  nG.gain.exponentialRampToValueAtTime(0.08, t + 0.05);
  nG.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
  noise.connect(nFilt).connect(nG).connect(master);

  body.start(t);
  air.start(t);
  noise.start(t);
  body.stop(t + 0.55);
  air.stop(t + 0.55);
  noise.stop(t + 0.55);
}
window.nikkiMeow = meow;
// Electron still gates AudioContext until a gesture — unlock so spawn/poke meows can play
document.addEventListener('pointerdown', () => ensureAudio(), { once: true });

function show(s) {
  if (s.state !== lastStatus.state && (s.state === 'needsYou' || s.state === 'done')) chime(s.state);
  lastStatus = s;
  touch();
  if (s.state === 'done' || s.state === 'error') unseen = s.state;
  else if (s.state !== 'idle') unseen = null; // a new turn: the old result is no news anymore
  if (s.state === 'thinking') setStepLine(s.text || 'Nikki denkt…');
  else if (s.state === 'working') setStepLine(s.text || 'Nikki arbeitet…');
  else if (s.state === 'needsYou') setStepLine(s.text || 'Nikki braucht dich!');
  else if (s.state === 'done') setStepLine(STEP_IDLE);
  else if (s.state === 'error') setStepLine(s.text || 'Nikki stolpert.');
  else if (s.state === 'idle') setStepLine(busy ? 'Nikki stoppte.' : STEP_IDLE);
  if ('answer' in s) {
    if (busy && s.state !== 'done' && s.state !== 'error' && s.state !== 'idle') {
      // live stream; empty answer clears stale text
      if (String(s.answer || '').trim()) setAnswer(s.answer, '', { stream: true });
      else {
        answer.hidden = true;
        answer.textContent = '';
        delete answer.dataset.stream;
      }
    } else if (s.state === 'done' && busy) {
      // only commit into the chat thread during an active turn
      finalizeAssistant(s.answer);
    } else {
      // errors and setup hints: show in the pane, never in chat history (N2)
      if (busy) turnFinalized = true;
      setAnswer(s.answer, s.state === 'error' ? 'error' : '');
    }
  }
  if (s.state === 'done' || s.state === 'error' || s.state === 'idle') {
    const wasBusy = busy;
    setBusy(false);
    refreshBranch(); // the task may have switched branches
    if (wasBusy) sendPlanFeedback();
  }
  renderState();
}

function setStepLine(text) {
  const el = $('stepLine');
  const next = (text && String(text).trim()) || STEP_IDLE;
  el.textContent = next;
  el.title = next;
  el.dataset.empty = String(next === STEP_IDLE); // hidden while Nikki just waits
}

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';
function reveal(el, from) {
  el.animate([{ opacity: 0, ...(!reduceMotion && from) }, { opacity: 1, transform: 'none', filter: 'none' }], { duration: 200, easing: EASE_OUT });
}
// prepareMd / onlyProse / normalizeMarkdown live in markdown-text.js (pure, tested)
try {
  marked.setOptions?.({ gfm: true, breaks: true });
} catch {}
// Sanitized Markdown; always run prepareMd so stream + final look the same
const md = (text) => DOMPurify.sanitize(marked.parse(prepareMd(text), { breaks: true, gfm: true }));
function newChatId() {
  return crypto.randomUUID?.() || `c-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
function scrollChatToEnd() {
  const out = $('output');
  if (out) out.scrollTop = out.scrollHeight;
}
function renderThread() {
  if (!threadEl) return;
  if (!chatMessages.length) {
    threadEl.replaceChildren();
    return;
  }
  const nodes = chatMessages.map((m) => {
    const div = document.createElement('div');
    div.className = `msg msg-${m.role === 'user' ? 'user' : 'assistant'}`;
    if (m.role === 'assistant') {
      div.classList.add('md');
      div.innerHTML = md(m.text);
    } else div.textContent = m.text;
    return div;
  });
  // main keeps only the last 80 messages per chat; say so instead of dropping them silently (N7)
  if (chatMessages.length >= 80) {
    const hint = document.createElement('p');
    hint.className = 'meta threadHint';
    hint.textContent = 'Nikki merkt sich nur die letzten 80 Nachrichten.';
    nodes.unshift(hint);
  }
  threadEl.replaceChildren(...nodes);
  scrollChatToEnd();
}
function currentChatLabel() {
  const raw =
    (chatTitle && chatTitle.trim()) ||
    chatMessages.find((m) => m.role === 'user')?.text ||
    '';
  const s = String(raw).replace(/\s+/g, ' ').trim();
  return s || 'Neuer Chat';
}
function syncChatsBtn() {
  const label = currentChatLabel();
  const name = $('chatName');
  if (name) name.textContent = label;
  const btn = $('chatsBtn');
  if (btn) {
    btn.title = label;
    btn.setAttribute('aria-label', `Chat: ${label}`);
  }
}
async function persistChat() {
  if (!chatId || !chatMessages.length) return;
  const title =
    (chatTitle && chatTitle.trim()) ||
    chatMessages.find((m) => m.role === 'user')?.text ||
    'Chat';
  chatsCache = (await api.chatsSave?.({
    id: chatId,
    cwd: chatCwd || '',
    sessionId: chatSessionId,
    title: title.slice(0, 80),
    messages: chatMessages,
  })) || chatsCache;
  await rememberLastChat(chatId);
  syncChatsBtn();
}
async function renameSavedChat(c, name) {
  const title = String(name || '').trim().slice(0, 80);
  if (!c?.id || !title || title === c.title) return;
  chatsCache =
    (await api.chatsSave?.({
      ...c,
      title,
      messages: c.messages || [],
    })) || chatsCache;
  // chats-save marks the chat as last opened; a rename must not change which chat opens at start (N7)
  if (lastChatId !== c.id) await rememberLastChat(lastChatId);
  if (chatId === c.id) chatTitle = title;
  syncChatsBtn();
}
async function deleteSavedChat(c) {
  if (!c?.id) return;
  chatsCache = (await api.chatsDelete?.(c.id)) || chatsCache.filter((x) => x.id !== c.id);
  if (chatId === c.id) {
    chatId = null;
    chatTitle = null;
    chatMessages = [];
    chatSessionId = null;
    chatCwd = null;
    renderThread();
    setEmptyAnswer();
    setStepLine(STEP_IDLE);
    syncChatsBtn();
  }
  if (lastChatId === c.id) {
    const next = chatsCache[0];
    await rememberLastChat(next?.id || null);
  }
  await openChatsMenu();
}
let streamRaf = 0;
let streamPending = null;
function paintStream(raw) {
  // Stream: normalize bold only — skip softBreakSentences (breaks mid-token like "Satz.N")
  const pretty = onlyProse(raw, normalizeMarkdown);
  const html = DOMPurify.sanitize(marked.parse(pretty, { breaks: true, gfm: true }));
  if (answer.dataset.streamHtml === html) {
    scrollChatToEnd();
    return;
  }
  answer.dataset.stream = '1';
  answer.dataset.streamHtml = html;
  answer.hidden = !pretty.trim();
  answer.className = 'md stream';
  answer.innerHTML = html;
  scrollChatToEnd();
}
function setAnswer(text, kind = '', { stream = false } = {}) {
  if (kind !== 'empty') delete answer.dataset.observed;
  const raw = String(text ?? '');
  if (stream) {
    // Live Markdown (bold/lists) without reveal flicker; one paint per frame
    streamPending = raw;
    if (streamRaf) return;
    streamRaf = requestAnimationFrame(() => {
      streamRaf = 0;
      const pending = streamPending;
      streamPending = null;
      if (pending != null) paintStream(pending);
    });
    return;
  }
  if (streamRaf) {
    cancelAnimationFrame(streamRaf);
    streamRaf = 0;
    streamPending = null;
  }
  delete answer.dataset.stream;
  delete answer.dataset.streamHtml;
  if (kind) answer.textContent = prepareMd(raw);
  else answer.innerHTML = md(raw);
  answer.className = kind || 'md';
  answer.hidden = !raw.trim() && kind !== 'empty';
  if (raw.trim() && kind !== 'empty') scrollChatToEnd();
}
function setEmptyAnswer() {
  delete answer.dataset.observed;
  if (chatMessages.length) {
    answer.hidden = true;
    answer.textContent = '';
    answer.className = '';
    renderThread();
    return;
  }
  setAnswer(
    current
      ? `Sag mir, was Claude in ${folderName(current)} tun soll.`
      : 'Wähl auf Home ein Projekt, dann leg los.',
    'empty',
  );
}
function beginChatTurn(userText, cwd) {
  if (!chatId) chatId = newChatId();
  chatCwd = cwd;
  turnFinalized = false;
  chatMessages.push({ role: 'user', text: userText, at: Date.now() });
  renderThread();
  setAnswer('');
  answer.hidden = true;
  syncChatsBtn();
}
function finalizeAssistant(text) {
  if (turnFinalized) return;
  turnFinalized = true;
  if (streamRaf) {
    cancelAnimationFrame(streamRaf);
    streamRaf = 0;
    streamPending = null;
  }
  // store raw; renderThread runs md/prepareMd once (avoid double soft-breaks)
  const clean = String(text ?? '').trim();
  if (clean) chatMessages.push({ role: 'assistant', text: clean, at: Date.now() });
  delete answer.dataset.stream;
  delete answer.dataset.streamHtml;
  answer.hidden = true;
  answer.textContent = '';
  answer.className = '';
  renderThread();
  persistChat();
}
async function openChatsMenu() {
  chatsCache = (await api.chatsList?.()) || [];
  const list = current ? chatsCache.filter((c) => c.cwd === current) : chatsCache;
  const nodes = [];
  if (!list.length) {
    const empty = document.createElement('p');
    empty.className = 'menuHint';
    empty.textContent = 'Noch keine gespeicherten Chats.';
    nodes.push(empty);
  } else {
    for (const c of list.slice(0, 12)) {
      const row = document.createElement('div');
      row.className = 'chatRow';
      const b = document.createElement('button');
      b.type = 'button';
      b.role = 'menuitem';
      b.className = 'chatOpen';
      b.title = c.cwd || '';
      const when = c.updatedAt ? new Date(c.updatedAt).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' }) : '';
      b.innerHTML = '<span class="chatTitle"></span><span class="chatMeta"></span>';
      b.children[0].textContent = c.title || 'Chat';
      b.children[1].textContent = when;
      b.addEventListener('click', () => {
        closeChatsMenu();
        loadChat(c);
      });
      const rename = document.createElement('button');
      rename.type = 'button';
      rename.className = 'chatRename';
      rename.title = 'Namen geben';
      rename.setAttribute('aria-label', 'Chat umbenennen');
      rename.innerHTML =
        '<svg class="icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M11.5 2.5 13.5 4.5 6 12H4v-2zM3 13.5h10"/></svg>';
      rename.addEventListener('click', (e) => {
        e.stopPropagation();
        startChatRename(row, c);
      });
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'chatDelete';
      del.title = 'Chat löschen';
      del.setAttribute('aria-label', 'Chat löschen');
      del.innerHTML =
        '<svg class="icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 4.5h9M6 4.5V3h4v1.5M5.5 4.5l.5 9h4l.5-9"/></svg>';
      del.addEventListener('click', async (e) => {
        e.stopPropagation();
        await deleteSavedChat(c);
      });
      row.append(b, rename, del);
      nodes.push(row);
    }
  }
  chatsMenu.replaceChildren(...nodes);
  chatsMenu.hidden = false;
  $('chatsBtn')?.setAttribute('aria-expanded', 'true');
}
function startChatRename(row, c) {
  const open = row.querySelector('.chatOpen');
  const titleEl = row.querySelector('.chatTitle');
  if (!open || !titleEl) return;
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'chatNameInput';
  input.value = c.title || '';
  input.maxLength = 80;
  input.placeholder = 'Name für diesen Chat';
  input.setAttribute('aria-label', 'Chat-Name');
  let finished = false; // Enter re-renders the menu, which blurs the input: save once (N8)
  const finish = async (save) => {
    if (finished) return;
    finished = true;
    if (save) await renameSavedChat(c, input.value);
    await openChatsMenu();
  };
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      e.preventDefault();
      finish(true);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      finish(false);
    }
  });
  input.addEventListener('click', (e) => e.stopPropagation());
  input.addEventListener('blur', () => finish(true));
  titleEl.replaceWith(input);
  open.querySelector('.chatMeta')?.remove();
  input.focus();
  input.select();
}
function closeChatsMenu() {
  if (!chatsMenu || chatsMenu.hidden) return;
  chatsMenu.hidden = true;
  $('chatsBtn')?.setAttribute('aria-expanded', 'false');
}
function loadChat(c, { activate = true } = {}) {
  if (!c || busy) return;
  chatId = c.id;
  chatTitle = c.title || null;
  chatMessages = Array.isArray(c.messages) ? [...c.messages] : [];
  // a session only resumes in its own project; ids from the removed agents mean nothing to Claude (B2)
  chatSessionId = c.cwd && (!c.backend || c.backend === 'claude') ? c.sessionId || null : null;
  chatCwd = c.cwd || null;
  turnFinalized = true;
  if (c.cwd) selectProject(c.cwd);
  // no session to resume: keep showing it, but the next prompt starts a new chat and this one stays as it was
  newSession = !chatSessionId;
  $('newBtn').setAttribute('aria-pressed', String(newSession));
  renderThread();
  setAnswer('');
  answer.hidden = true;
  setStepLine(STEP_IDLE);
  rememberLastChat(c.id);
  syncChatsBtn();
  if (activate) {
    setView('chat');
    setOpen(true);
    show({ state: 'idle', text: 'Nikki wartet…' });
  }
}

function setBusy(b) {
  busy = b;
  go.classList.toggle('stop', b);
  go.setAttribute('aria-label', b ? 'Stoppen' : 'Senden');
  // lock project/model switching while a task runs (stop still works)
  if (b) {
    closeModelMenu();
    closeChatsMenu();
    closeMenu();
  }
  $('modelBtn')?.toggleAttribute('disabled', b);
  $('projectBtn')?.toggleAttribute('disabled', b);
  $('chatsBtn')?.toggleAttribute('disabled', b);
  $('newBtn')?.toggleAttribute('disabled', b);
}

// Animated when clicked; instant when opened from the keyboard or tray (opened many times a day).
// focus: false when nobody asked for the island (a card arrived): it must not take the keyboard from the terminal the user types in
function setOpen(v, { instant = false, focus = true } = {}) {
  if (v === open) return;
  open = v;
  if (instant) {
    island.classList.add('instant');
    requestAnimationFrame(() => requestAnimationFrame(() => island.classList.remove('instant')));
  }
  island.classList.toggle('open', v);
  $('notch').setAttribute('aria-expanded', String(v));
  fitIsland();
  touch();
  renderState();
  if (!v) {
    closeMenu();
    closeModelMenu();
    closeChatsMenu();
  }
  if (v) {
    if (focus) api.focus();
    if (view === 'chat' && !perms.length) promptEl.focus();
  }
}

// The open island has an explicit height so it can glide (CSS) to whatever the page needs; closed it is the notch.
const panelBox = $('panelBox');
function fitIsland() {
  island.style.height = open ? `${panelBox.offsetHeight}px` : '';
}
new ResizeObserver(fitIsland).observe(panelBox);

// ---- branch of the selected project: on project switch and turn end only, no polling (M12)
async function refreshBranch() {
  const cwd = current;
  const name = cwd && showBranch ? await api.branch(cwd).catch(() => null) : null;
  if (cwd !== current) return; // the project changed while git ran
  $('branch').hidden = !name;
  $('branchName').textContent = name || '';
  $('branch').title = name ? `Branch: ${name}` : '';
}

// ---- projects
function selectProject(p) {
  if (busy) return;
  // a chat belongs to its project: switching starts a fresh chat, the old one stays untouched (B2)
  if (p !== chatCwd && chatMessages.length) setNewSession(true);
  current = p;
  $('projectName').textContent = p ? folderName(p) : 'Projekt wählen';
  $('projectBtn').title = p ?? '';
  const saved = modelOf(p);
  setModel(MODELS.some(([v]) => v === saved) ? saved : null);
  if (!answer.textContent.trim() || answer.classList.contains('empty')) setEmptyAnswer();
  refreshBranch();
  renderHome();
}
function renderMenu() {
  const items = projects.map((p) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.role = 'menuitemradio';
    b.setAttribute('aria-checked', String(p === current));
    b.title = p;
    b.innerHTML = `${ICON_FOLDER}<span></span>`;
    b.lastChild.textContent = folderName(p);
    b.addEventListener('click', () => {
      selectProject(p);
      closeMenu();
    });
    return b;
  });
  const pick = document.createElement('button');
  pick.type = 'button';
  pick.role = 'menuitem';
  pick.innerHTML = `${svg('M8 3.5v9M3.5 8h9')}<span>Ordner wählen…</span>`;
  pick.addEventListener('click', async () => {
    closeMenu();
    await pickFolder();
  });
  menu.replaceChildren(...items, ...(items.length ? [document.createElement('hr')] : []), pick);
}
function openMenu() {
  renderMenu();
  menu.hidden = false;
  $('projectBtn').setAttribute('aria-expanded', 'true');
  menu.querySelector('button')?.focus();
}
function closeMenu() {
  if (menu.hidden) return;
  menu.hidden = true;
  $('projectBtn').setAttribute('aria-expanded', 'false');
}
// ---- session chips

// chat header: our own project chip first (active unless a terminal session is pinned), then the observed sessions
// a pinned terminal session shows Claude's last answer from there (Stop hook) instead of our own conversation
let termReplyKey = '';
function renderTermReply(t) {
  $('output').classList.toggle('pinned', !!t);
  const box = $('termReply');
  box.hidden = !t;
  const key = t ? `${t.id}\n${t.last ?? ''}` : '';
  if (key === termReplyKey) return;
  termReplyKey = key;
  if (!t) return scrollChatToEnd();
  const body = document.createElement('div');
  if (t.last) {
    body.className = 'msg msg-assistant md';
    body.innerHTML = md(t.last);
  } else {
    body.className = 'msg termEmpty';
    body.textContent = 'Noch keine Antwort. Sobald Claude dort fertig ist, steht sie hier.';
  }
  const hint = Object.assign(document.createElement('p'), { className: 'meta termHint', textContent: 'aus dem Terminal' });
  box.replaceChildren(hint, body);
  scrollChatToEnd();
}
function renderSessionPills() {
  const pinnedT = focusSession && terminal.find((t) => t.id === focusSession);
  renderTermReply(pinnedT || null);
  promptEl.placeholder = pinnedT ? `Nachricht an ${folderName(pinnedT.cwd)} vormerken…` : 'Was soll Claude tun?';
  $('ownDot').dataset.state = ownState();
  $('projectBtn').setAttribute('aria-pressed', String(!focusSession));
  const box = $('sessionPills');
  const ranked = [...terminal]
    .filter((t) => t.state && t.state !== 'idle')
    .sort((a, b) => (RANK[b.state] || 0) - (RANK[a.state] || 0) || b.at - a.at)
    .slice(0, MAX_SESSION_PILLS);
  if (focusSession && !ranked.some((t) => t.id === focusSession)) {
    const pinned = terminal.find((t) => t.id === focusSession);
    if (pinned) ranked.unshift(pinned);
    while (ranked.length > MAX_SESSION_PILLS) ranked.pop();
  }
  box.hidden = !ranked.length;
  box.replaceChildren(
    ...ranked.map((t) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.setAttribute('aria-pressed', String(t.id === focusSession));
      b.title = `beobachtet: ${t.cwd}\n${t.text}`;
      const label = document.createElement('span');
      label.textContent = `${folderName(t.cwd)} · Terminal`;
      b.append(sessionDot(t.state), label);
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        focusSession = focusSession === t.id ? null : t.id;
        renderState();
      });
      return b;
    }),
  );
}
function setModel(m) {
  model = m;
  $('modelName').textContent = modelLabel(m);
}
function pickModel(m) {
  setModel(m);
  if (!current) return;
  models[current] = m;
  api.setModel?.(current, 'claude', m);
}
function openModelMenu() {
  if (busy) return;
  modelMenu.replaceChildren(
    ...MODELS.map(([v, label]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.role = 'menuitemradio';
      b.setAttribute('aria-checked', String(v === model));
      b.textContent = label;
      b.addEventListener('click', () => {
        pickModel(v);
        closeModelMenu();
      });
      return b;
    }),
  );
  modelMenu.hidden = false;
  $('modelBtn').setAttribute('aria-expanded', 'true');
  modelMenu.querySelector('[aria-checked="true"]')?.focus();
}
function closeModelMenu() {
  if (!modelMenu || modelMenu.hidden) return;
  modelMenu.hidden = true;
  $('modelBtn').setAttribute('aria-expanded', 'false');
}

async function pickFolder() {
  const p = await api.pickFolder();
  if (!p) return null;
  projects = (await api.getState()).projects;
  selectProject(p);
  return p;
}

// ---- run
// A pinned terminal session gets the text when its turn ends (Stop hook); an idle one has no turn to end.
async function queueForTerminal(text) {
  const t = terminal.find((x) => x.id === focusSession);
  if (!t) return;
  if (!['working', 'thinking', 'needsYou'].includes(t.state)) {
    setStepLine(`${folderName(t.cwd)} ist gerade fertig. Antworte im Terminal; vormerken geht, solange Claude dort arbeitet.`);
    return;
  }
  if (!(await api.queueMessage(t.id, text))) {
    setStepLine('Vormerken geht nur mit „Terminal-Sessions beobachten“ und „Freigaben in Nikki beantworten“.');
    return;
  }
  promptEl.value = '';
  setStepLine(`Vorgemerkt für ${folderName(t.cwd)}: Claude bekommt es, sobald der Zug fertig ist.`);
}
async function start() {
  const text = promptEl.value.trim();
  if (text && focusSession) return queueForTerminal(text);
  if (!text || busy) return;
  const cwd = current || (await pickFolder());
  if (!cwd) return;
  if (!claudeFound) {
    show({ state: 'error', text: 'Nikki findet Claude nicht.' });
    setAnswer('Installier Claude Code und melde dich einmal mit „claude“ im Terminal an.', 'error');
    return;
  }
  setBusy(true);
  setView('chat');
  setStepLine('Nikki startet…');
  show({ state: 'thinking', text: 'Nikki startet…' });
  const resumeId = newSession ? undefined : chatSessionId || undefined;
  // main rejects when it cannot save its state; without the catch the island would stay busy for good (H4)
  const started = await api.start(text, cwd, { newSession, plan, model, sessionId: resumeId }).catch((e) => {
    console.error(e);
    return false;
  });
  if (!started) {
    setBusy(false);
    show({ state: 'error', text: 'Nikki kommt nicht los.' });
    setAnswer('Der Start ist fehlgeschlagen. Läuft schon eine Aufgabe, oder existiert der Ordner nicht mehr?', 'error');
    return;
  }
  models[cwd] = model;
  if (newSession) {
    chatId = newChatId();
    chatTitle = null;
    chatMessages = [];
    chatSessionId = null;
  }
  beginChatTurn(text, cwd);
  setNewSession(false);
  setPlan(false);
  promptEl.value = '';
  delete answer.dataset.observed;
}
// plan rejected with a reason: that turn ends and the reason goes in as the next user prompt (B7)
let planFeedback = null;
function sendPlanFeedback() {
  const text = planFeedback;
  planFeedback = null;
  if (!text) return;
  promptEl.value = [text, promptEl.value.trim()].filter(Boolean).join('\n\n');
  setPlan(true);
  start();
}
function setNewSession(v) {
  newSession = v;
  $('newBtn').setAttribute('aria-pressed', String(v));
  if (v && !busy) {
    chatId = newChatId();
    chatTitle = null;
    chatMessages = [];
    chatSessionId = null;
    chatCwd = null;
    turnFinalized = true;
    renderThread();
    setStepLine(STEP_IDLE);
    setEmptyAnswer();
    syncChatsBtn();
    show({ state: 'idle', text: 'Nikki wartet…' });
  }
}

function setPlan(v) {
  plan = v;
  $('planBtn').setAttribute('aria-pressed', String(v));
  promptEl.placeholder = v ? 'Was soll Claude planen?' : 'Was soll Claude tun?';
}

// ---- permissions, questions (AskUserQuestion) and plans (ExitPlanMode) share one card
function detail(input = {}) {
  return String(input.command ?? input.file_path ?? input.url ?? JSON.stringify(input, null, 2)).slice(0, 800);
}
function button(label, cls, onClick, key, shortcuts) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = cls;
  b.textContent = label;
  b.addEventListener('click', onClick);
  if (key) cardKey(b, key, shortcuts);
  return b;
}
// a card key (see the keydown handler below): a small badge on the button; screen readers get aria-keyshortcuts instead
function cardKey(b, key, shortcuts = key) {
  b.dataset.hotkey = key.toLowerCase();
  b.setAttribute('aria-keyshortcuts', shortcuts);
  b.append(Object.assign(document.createElement('kbd'), { className: 'key', textContent: key, ariaHidden: 'true' }));
}
function field(tag, placeholder) {
  const el = document.createElement(tag);
  el.className = 'other';
  el.placeholder = el.ariaLabel = placeholder;
  if (tag === 'textarea') el.rows = 1;
  return el;
}
let cardId = null;
let cardAt = 0; // when the card on screen appeared: its hotkeys wait a moment, so keys typed for something else never answer it
function renderPerm() {
  const r = perms[0];
  const wasHidden = $('permission').hidden;
  if (r && r.id !== cardId) cardAt = Date.now();
  cardId = r?.id ?? null;
  $('permission').hidden = !r;
  go.disabled = !!r; // stop is locked while a card waits (B6)
  const body = $('permBody');
  if (!r) {
    body?.classList.remove('choiceRow');
    return;
  }
  if (wasHidden) reveal($('permission'), { transform: 'translateY(4px)' });
  requestAnimationFrame(scrollChatToEnd); // the card sits inline, after the conversation
  if (r.toolName === 'AskUserQuestion') return renderQuestion(r);
  body.classList.remove('choiceRow');
  if (r.toolName === 'ExitPlanMode') return renderPlan(r);
  $('permTitle').textContent = (r.origin === 'terminal' ? `${folderName(r.cwd)} · Terminal: ` : '') + (r.title ?? `${r.toolName} ausführen?`);
  const code = document.createElement('code');
  code.className = 'detail';
  code.textContent = detail(r.input);
  body.replaceChildren(code);
  $('permActions').replaceChildren(
    button('Erlauben', 'primary', () => answerPerm({ answer: 'allow' }), 'A', 'A Enter'),
    ...(r.origin === 'terminal' && !r.canAlways ? [] : [button('Immer', 'soft', () => answerPerm({ answer: 'always' }), 'I')]),
    button('Ablehnen', 'danger', () => answerPerm({ answer: 'deny' }), 'D'),
  );
}

// one question at a time; a single-choice click answers it, multi-choice needs "Weiter"
let asked = null; // { id, i, picks } for the request on screen
function renderQuestion(r) {
  const qs = r.input.questions ?? [];
  if (!qs.length) {
    $('permTitle').textContent = r.title || 'Auswahl';
    $('permBody').replaceChildren();
    $('permActions').replaceChildren(button('Schließen', 'ghost', () => answerPerm({ answer: 'deny' }), 'D'));
    return;
  }
  if (asked?.id !== r.id) asked = { id: r.id, i: 0, picks: [] };
  const q = qs[asked.i];
  const qText = q.question || q.prompt || 'Auswahl';
  const opts = (q.options ?? []).map((o) => (typeof o === 'string' ? { label: o } : o));
  const next = (pick) => {
    if (!pick.length) return;
    asked.picks[asked.i] = pick;
    if (++asked.i < qs.length) renderQuestion(r);
    else answerPerm({ answer: 'allow', picks: asked.picks });
  };
  const chosen = new Set();
  const other = field('input', 'Eigene Antwort…');
  const typed = () => (other.value.trim() ? [other.value.trim()] : []);
  other.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    next(q.multiSelect ? [...chosen, ...typed()] : typed());
  });
  const options = opts.map((o, i) => {
    const label = o.label || o.id || String(o);
    const b = button('', 'opt', () => {
      if (!q.multiSelect) return next([label]);
      chosen.has(label) ? chosen.delete(label) : chosen.add(label);
      b.setAttribute('aria-pressed', String(chosen.has(label)));
    });
    if (q.multiSelect) b.setAttribute('aria-pressed', 'false');
    b.innerHTML = '<strong></strong><span></span>';
    b.firstChild.textContent = label;
    b.lastChild.textContent = o.description ?? '';
    if (i < 9) cardKey(b, String(i + 1));
    return b;
  });
  $('permTitle').textContent = qs.length > 1 ? `${qText} (${asked.i + 1}/${qs.length})` : qText;
  const body = $('permBody');
  body.classList.toggle('choiceRow', opts.length === 2 && opts.every((o) => !(o.description)));
  body.replaceChildren(...options, other);
  $('permActions').replaceChildren(
    button('Überspringen', 'ghost', () => answerPerm({ answer: 'deny', message: 'Der Nutzer wollte die Frage nicht beantworten.' }), 'D'),
    ...(q.multiSelect ? [button('Weiter', 'primary', () => next([...chosen, ...typed()]), '↵', 'Enter')] : []),
  );
}

function renderPlan(r) {
  const text = document.createElement('div');
  text.className = 'md plan';
  text.innerHTML = md(String(r.input.plan ?? 'Kein Plan-Text.'));
  const why = field('textarea', 'Was soll anders werden? (optional)');
  $('permTitle').textContent = 'Plan prüfen';
  $('permBody').replaceChildren(text, why);
  $('permActions').replaceChildren(
    button('Annehmen', 'primary', () => answerPerm({ answer: 'allow' }), 'A', 'A Enter'),
    button('Ablehnen', 'danger', () => {
      const wish = why.value.trim();
      if (!wish) return answerPerm({ answer: 'deny', message: 'Plan abgelehnt, bitte überarbeiten.' });
      // a deny message reads like a tool error to the agent; the same words follow as a real user prompt
      planFeedback = wish;
      answerPerm({
        answer: 'deny',
        interrupt: true,
        message: `Plan abgelehnt. Der Nutzer möchte: „${wish}“. Er schickt dir das gleich als eigene Nachricht. Beende deinen Zug jetzt ohne weitere Schritte.`,
      });
    }, 'D'),
  );
}

// the card takes the keyboard so its hotkeys work, unless the user is typing something: a draft is never taken over
function focusCard() {
  const el = document.activeElement;
  if (typingIn(el) && el.value?.trim()) return;
  $('permission').focus({ preventScroll: true });
}
const typingIn = (el) => !!el?.matches?.('textarea, select, [contenteditable="true"], input:not([type="checkbox"], [type="radio"], [type="button"])');

function answerPerm(a) {
  const r = perms.shift();
  if (!r) return;
  api.answerPermission(r.id, a);
  const focused = document.activeElement;
  renderPerm();
  // the keyboard stays with the next card, or goes back to the composer (the card's buttons were just replaced or hidden)
  if (focused === document.body || $('permission').contains(focused)) (perms.length ? $('permission') : promptEl).focus({ preventScroll: true });
  if (r.origin === 'terminal') return renderState();
  if (!perms.length) show({ state: 'working', text: 'Nikki macht weiter…' });
}

// ---- terminal sessions: chips in the chat header, rows on the Home tile
function renderTerminal() {
  if (focusSession && !terminal.some((t) => t.id === focusSession)) focusSession = null;
  renderState();
}

// ---- drop onto the island: in the chat tab quoted paths go into the prompt; in any other tab files and text go to the shelf
document.addEventListener('dragover', (e) => {
  e.preventDefault();
  island.classList.toggle('drop', !!e.target.closest?.('.hit'));
});
document.addEventListener('dragleave', (e) => !e.relatedTarget && island.classList.remove('drop'));
document.addEventListener('drop', (e) => {
  e.preventDefault();
  island.classList.remove('drop');
  if (!e.target.closest?.('.hit')) return;
  const paths = [...e.dataTransfer.files].map((f) => api.pathForFile(f)).filter(Boolean);
  const dropped = paths.length ? '' : e.dataTransfer.getData('text/plain').trim();
  // closed, the island counts as the tab it was last on
  const taker = view !== 'chat' && [...live.keys()].find((id) => NikkiModules.get(id).drop);
  if (taker && (paths.length || dropped)) {
    setOpen(true);
    setView(taker);
    NikkiModules.get(taker).drop({ paths, text: dropped });
    return;
  }
  if (!paths.length) return;
  setOpen(true);
  setView('chat');
  promptEl.focus();
  const before = promptEl.value.slice(0, promptEl.selectionStart);
  const text = paths.map((p) => `"${p}"`).join(' ');
  promptEl.setRangeText(`${before && !/\s$/.test(before) ? ' ' : ''}${text} `, promptEl.selectionStart, promptEl.selectionEnd, 'end');
});

// ---- wiring
$('notch').addEventListener('click', () => setOpen(true));
$('tabs').addEventListener('click', (e) => {
  const btn = e.target.closest('.tab');
  if (btn) setView(btn.dataset.view);
  else setOpen(false); // the empty strip closes the island, like the old bar did
});
$('toChat').addEventListener('click', () => setView('chat'));
$('newBtn').addEventListener('click', () => setNewSession(!newSession));
$('planBtn').addEventListener('click', () => setPlan(!plan));
$('projectBtn').addEventListener('click', () => {
  if (focusSession) {
    focusSession = null; // back to our own session first
    return renderState();
  }
  menu.hidden ? openMenu() : closeMenu();
});

// ---- settings page: main owns the values; every change comes back as the whole set
function applySettings(s) {
  settings = s;
  muted = s.muted;
  sleepMin = s.sleepMin;
  if (showBranch !== s.showBranch) {
    showBranch = s.showBranch;
    refreshBranch();
  }
  $('setAutostart').checked = s.autostart;
  $('setAutostart').disabled = !s.autostartAvailable;
  $('autostartHint').hidden = s.autostartAvailable;
  if (!capturing) $('setHotkey').textContent = hotkeyLabel(s.hotkey);
  $('setSound').checked = !s.muted;
  $('setAwake').checked = s.keepAwake;
  $('setSleep').value = s.sleepMin;
  $('setHooks').checked = s.hooks;
  $('setRelay').checked = s.relay;
  $('setRelay').disabled = !s.hooks;
  $('setClaudePath').textContent = s.claudePath || 'nicht gefunden';
  $('setClaudePath').title = s.claudePath || '';
  $('setClaudePath').classList.toggle('bad', !s.claudePath);
  $('setBranch').checked = s.showBranch;
  applyModules(s.modules);
  renderGlance();
}
const setSetting = async (key, value) => applySettings(await api.settingsSet(key, value));
$('setAutostart').addEventListener('change', (e) => setSetting('autostart', e.target.checked));
$('setSound').addEventListener('change', (e) => setSetting('muted', !e.target.checked));
$('setAwake').addEventListener('change', (e) => setSetting('keepAwake', e.target.checked));
$('setSleep').addEventListener('change', (e) => setSetting('sleepMin', Number(e.target.value)));
$('setHooks').addEventListener('change', (e) => setSetting('hooks', e.target.checked));
$('setRelay').addEventListener('change', (e) => setSetting('relay', e.target.checked));
$('setBranch').addEventListener('change', (e) => setSetting('showBranch', e.target.checked));

// ---- modules (modules.js): tab, page and Home tile for each one switched on; switching works without a restart
let modList = []; // [{ id, on }] in tab order, the switched off ones too (settings page)
const live = new Map(); // id -> ctx of each module switched on
const tileOf = new Map(); // id -> its Home tile
function moduleCtx(mod) {
  const ctx = {
    reduceMotion,
    load: () => api.moduleGet(mod.id),
    save: (data) => api.moduleSet(mod.id, data),
    changed: () => (renderTile(mod.id), renderGlance()), // data changed: its tile and the closed notch follow
    notch: () => renderGlance(), // a countdown ticks: only the closed notch
    open: () => (setView(mod.id), setOpen(true)),
    shown: () => open && view === mod.id,
    project: () => current,
    folderName,
    chime,
    toast: (text) => api.toast(text),
    // into the composer, not sent: the user reads and sends it; a to-do of another project switches to it
    toChat: (text, cwd) => {
      if (cwd && cwd !== current) selectProject(cwd);
      setView('chat');
      setOpen(true);
      promptEl.value = [promptEl.value.trim(), text].filter(Boolean).join('\n\n');
      promptEl.focus();
    },
    // the module's name opens its page (keyboard path; a click anywhere on the tile does the same), meta on the right
    head: (meta = '', tone = '') => {
      const b = button(mod.title, 'tileHead', ctx.open);
      const m = b.appendChild(document.createElement('span'));
      m.textContent = meta;
      if (tone) m.className = tone;
      return b;
    },
  };
  return ctx;
}
function renderTile(id) {
  const el = tileOf.get(id);
  if (!el) return;
  el.replaceChildren();
  NikkiModules.get(id).tile(el, live.get(id));
}
function moduleTab(mod) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'tab';
  b.dataset.view = mod.id;
  b.setAttribute('aria-pressed', String(view === mod.id));
  b.setAttribute('aria-label', mod.title);
  b.title = mod.title;
  b.innerHTML = mod.icon; // fixed markup from the module's own code
  return b;
}
function applyModules(saved) {
  const next = moduleList(saved, [...NikkiModules.keys()]);
  if (JSON.stringify(next) === JSON.stringify(modList)) return;
  modList = next;
  const on = modList.filter((m) => m.on).map((m) => m.id);
  for (const id of [...live.keys()]) {
    if (on.includes(id)) continue;
    NikkiModules.get(id).stop?.();
    live.delete(id);
    tileOf.get(id)?.remove();
    tileOf.delete(id);
    $(VIEWS[id])?.remove();
    delete VIEWS[id];
  }
  for (const id of on) {
    if (live.has(id)) continue;
    const mod = NikkiModules.get(id);
    const ctx = moduleCtx(mod);
    live.set(id, ctx);
    const page = Object.assign(document.createElement('section'), { id: `view-${id}`, className: `view modView mod-${id}`, hidden: true });
    page.setAttribute('aria-label', mod.title);
    panelBox.append(page);
    VIEWS[id] = page.id;
    if (mod.tile) {
      const tile = Object.assign(document.createElement('div'), { className: 'tile modTile' });
      tile.addEventListener('click', (e) => !e.target.closest('button, input, label, a, textarea, select') && ctx.open());
      tileOf.set(id, tile);
    }
    // loads its data; until then tile and page show the module's empty state
    Promise.resolve()
      .then(() => mod.start?.(ctx))
      .catch((e) => console.error(`module ${id}:`, e))
      .then(() => {
        if (live.get(id) !== ctx) return; // switched off meanwhile
        ctx.changed();
        if (view === id) mod.page(page, ctx);
      });
  }
  // tabs and tiles follow the order of the list; append moves an existing tile into place
  $('moduleTabs').replaceChildren(...on.map((id) => moduleTab(NikkiModules.get(id))));
  $('homeTiles').append(...on.filter((id) => tileOf.has(id)).map((id) => tileOf.get(id)));
  for (const id of on) renderTile(id);
  renderModuleSettings();
  if (!VIEWS[view]) setView('home');
}
function renderModuleSettings() {
  const box = $('setModuleList');
  const had = document.activeElement?.closest?.('#setModuleList [data-key]')?.dataset.key; // keep the focus across the re-render
  const control = (el, key) => ((el.dataset.key = key), el);
  box.replaceChildren(
    ...modList.map((m, i) => {
      const mod = NikkiModules.get(m.id);
      const name = Object.assign(document.createElement('label'), { className: 'modName', htmlFor: `mod-${m.id}` });
      name.innerHTML = mod.icon;
      name.append(mod.title);
      const move = (d, label, path) => {
        const b = control(button('', 'iconBtn', () => moveModule(i, d)), `${m.id}:${d}`);
        b.innerHTML = svg(path);
        b.title = label;
        b.setAttribute('aria-label', `${mod.title} ${label}`);
        b.disabled = !modList[i + d];
        return b;
      };
      const sw = control(Object.assign(document.createElement('input'), { type: 'checkbox', className: 'switch', id: `mod-${m.id}`, checked: m.on }), `${m.id}:on`);
      sw.setAttribute('role', 'switch');
      sw.addEventListener('change', () => setSetting('modules', modList.map((x) => (x.id === m.id ? { ...x, on: sw.checked } : x))));
      const row = Object.assign(document.createElement('div'), { className: 'setRow modRow' });
      row.append(name, move(-1, 'nach oben', 'M4.5 9.5 8 6l3.5 3.5'), move(1, 'nach unten', 'M4.5 6.5 8 10l3.5-3.5'), sw);
      return row;
    }),
  );
  const again = had && box.querySelector(`[data-key="${had}"]`);
  (again && !again.disabled ? again : again?.parentElement.querySelector('.switch'))?.focus();
}
function moveModule(i, d) {
  const list = [...modList];
  [list[i], list[i + d]] = [list[i + d], list[i]];
  setSetting('modules', list);
}

// hotkey: click, then press the new combo; main keeps the old one when the new one is taken
let capturing = false;
const hotkeyBtn = $('setHotkey');
const hotkeyMsg = (text, bad = false) => {
  $('hotkeyMsg').textContent = text;
  $('hotkeyMsg').classList.toggle('bad', bad);
};
function stopCapture() {
  if (!capturing) return;
  capturing = false;
  removeEventListener('keydown', onHotkeyKey, true);
  hotkeyBtn.setAttribute('aria-pressed', 'false');
  hotkeyBtn.textContent = hotkeyLabel(settings.hotkey);
}
async function onHotkeyKey(e) {
  e.preventDefault();
  e.stopPropagation(); // Escape cancels here, it must not close the island
  if (e.key === 'Escape') {
    stopCapture();
    return hotkeyMsg('');
  }
  const acc = acceleratorFor(e);
  if (!acc) return; // modifiers alone so far, or a key that cannot be a hotkey
  stopCapture();
  const s = await api.settingsSet('hotkey', acc);
  applySettings(s);
  if (s.error === 'taken') hotkeyMsg(`${hotkeyLabel(acc)} ist schon belegt. Nikki bleibt bei ${hotkeyLabel(s.hotkey)}.`, true);
  else if (s.error) hotkeyMsg(`${hotkeyLabel(acc)} kann Windows nicht belegen.`, true);
  else hotkeyMsg(`Nikki hört jetzt auf ${hotkeyLabel(s.hotkey)}.`);
}
hotkeyBtn.addEventListener('click', () => {
  if (capturing) return stopCapture();
  capturing = true;
  hotkeyBtn.setAttribute('aria-pressed', 'true');
  hotkeyBtn.textContent = 'Drück die Tasten…';
  hotkeyMsg('Esc bricht ab.');
  addEventListener('keydown', onHotkeyKey, true);
});
hotkeyBtn.addEventListener('blur', () => {
  if (!capturing) return;
  stopCapture();
  hotkeyMsg('');
});
$('chatsBtn')?.addEventListener('click', (e) => {
  e.stopPropagation();
  if (chatsMenu && !chatsMenu.hidden) closeChatsMenu();
  else openChatsMenu();
});
$('modelBtn').addEventListener('click', () => (modelMenu.hidden ? openModelMenu() : closeModelMenu()));
document.addEventListener('click', (e) => {
  if (!e.target.closest('.projectWrap')) closeMenu();
  if (!e.target.closest('.chatsWrap')) closeChatsMenu();
  if (!e.target.closest('.modelWrap')) closeModelMenu();
  const link = e.target.closest('a[href]');
  if (link) {
    e.preventDefault();
    api.openExternal(link.href);
  }
});
// only the stop button stops, and not while a card waits for an answer (B6)
$('composer').addEventListener('submit', (e) => {
  e.preventDefault();
  if (!busy) return start();
  if (perms.length) return;
  planFeedback = null; // stopped on purpose: don't send the plan reason afterwards
  api.stop();
});
promptEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    start(); // no-op while busy: Enter never stops a task
  }
});
addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!menu.hidden) {
    closeMenu();
    $('projectBtn').focus();
  } else if (modelMenu && !modelMenu.hidden) {
    closeModelMenu();
  } else if (chatsMenu && !chatsMenu.hidden) {
    closeChatsMenu();
  } else if (!perms.length) setOpen(false); // a waiting card keeps the island open: Esc does nothing then
});
// Card hotkeys while the island has the focus: A or Enter allows (accepts a plan), I always, D denies (skips a question),
// 1-9 pick an option. Never while a text field has the focus (composer, own answer, plan feedback); a focused button keeps its own Enter.
addEventListener('keydown', (e) => {
  if (!perms.length || !open || e.repeat || e.ctrlKey || e.altKey || e.metaKey || typingIn(document.activeElement)) return;
  if (Date.now() - cardAt < 500) return;
  const card = $('permission');
  const key = e.key.toLowerCase();
  let target = null;
  if (e.key === 'Enter') {
    if (document.activeElement?.matches?.('button, a[href]')) return;
    target = card.querySelector('[aria-keyshortcuts~="Enter"]');
  } else if (/^[a-z1-9]$/.test(key)) target = card.querySelector(`[data-hotkey="${key}"]`);
  if (!target || target.disabled) return;
  e.preventDefault();
  target.click();
});

api.onToggle(() => setOpen(!open, { instant: true }));
api.onShow?.((page) => {
  if (page) setView(page);
  setOpen(true, { instant: true });
});
api.onStatus(show);
api.onSession?.(({ id }) => {
  if (!id) return;
  chatSessionId = id;
  if (chatId) persistChat();
});
api.onPointer(({ x, y }) => {
  buddyEmit('lookAt', x, y);
  const over = document.elementFromPoint(x, y);
  // the pointer over the notch wakes Nikki; while it rests there she stays awake
  const nowOver = !!over?.closest('#island');
  if (nowOver) touch();
  if (nowOver !== hover) {
    hover = nowOver;
    renderGlance();
  }
  // also during a drag from Explorer, where no mousemove arrives: catch the drop only over the island
  setThrough(!over?.closest('.hit'));
});
api.onTerminal(({ sessions, changed }) => {
  terminal = sessions;
  if (changed) touch();
  renderTerminal();
  if (changed === 'needsYou' || changed === 'done') chime(changed);
});
api.onPermissionRequest((r) => {
  perms.push(r);
  if (r.origin === 'terminal') focusSession = r.sessionId; // the chat header shows whose card this is
  renderPerm();
  setView('chat');
  setOpen(true, { focus: false });
  if (perms[0] === r) focusCard();
  if (r.origin === 'terminal') return renderState();
  const text =
    r.toolName === 'AskUserQuestion'
      ? 'Nikki fragt dich!'
      : r.toolName === 'ExitPlanMode'
        ? 'Nikki zeigt Plan!'
        : 'Nikki will OK!';
  show({ state: 'needsYou', text });
});
api.onQueued?.(({ sessionId, text }) => {
  const t = terminal.find((x) => x.id === sessionId);
  if (text === null && t) setStepLine(`Nachricht an ${folderName(t.cwd)} übergeben.`);
});
api.onPermissionCancel((id) => {
  perms = perms.filter((p) => p.id !== id);
  if (asked?.id === id) asked = null;
  renderPerm();
  if (!perms.length && lastStatus.state === 'needsYou') show({ state: 'working', text: 'Nikki macht weiter…' });
});

(async () => {
  buddies = [createCompanion({ walker: $('homeWalker'), stage: $('homeStage'), island, mode: 'blob', pinned: true })];

  setView('home');
  const state = await api.getState();
  applySettings(await api.settingsGet()); // before the hello meow so mute is respected
  projects = state.projects;
  models = state.models ?? {};
  terminal = state.terminal;
  lastChatId = state.lastChatId ?? null;
  claudeFound = state.claudeFound;
  selectProject(projects[0] ?? null);
  renderTerminal();
  try {
    chatsCache = (await api.chatsList?.()) || [];
    const last = chatsCache.find((c) => c.id === lastChatId) || chatsCache[0];
    if (last) loadChat(last, { activate: false });
    else syncChatsBtn();
  } catch {
    syncChatsBtn();
  }

  // main keeps the window hidden while a fullscreen app runs: say hello once it can be seen
  while (document.visibilityState !== 'visible') await new Promise((r) => document.addEventListener('visibilitychange', r, { once: true }));
  island.classList.remove('boot'); // fades in from above, then opens on Home
  setOpen(true);
  meow();

  if (!claudeFound) {
    show({ state: 'error', text: 'Nikki findet Claude nicht.' });
    setAnswer('Installier Claude Code und melde dich einmal mit „claude“ im Terminal an.', 'error');
  }
})();
