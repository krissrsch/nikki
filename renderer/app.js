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
let model = null; // null = the CLI's default model for active backend
let models = {}; // per project: string (legacy) or { claude, cursor, gemini }
let backends = {}; // last backend per project: claude | cursor | gemini
let favorites = { claude: [], cursor: [], gemini: [] }; // starred model ids per KI (__auto__ = Standard/Auto)
let backend = 'claude';
let modelMenuFor = 'claude'; // which agent the home model menu edits
const favKey = (id) => (id === 'gemini' || id === 'aistudio' ? 'gemini' : id === 'cursor' ? 'cursor' : 'claude');
const favId = (v) => (v == null || v === '' ? '__auto__' : String(v));
const favList = (id = modelMenuFor) => favorites[favKey(id)] || [];
const isFav = (v, id = modelMenuFor) => favList(id).includes(favId(v));
const STAR = '<svg class="icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.8 9.9 6l4.6.4-3.5 3 1.1 4.5L8 11.7 3.9 13.9l1.1-4.5-3.5-3L6.1 6z"/></svg>';

function modelFor(agentId, cwd = current) {
  if (!cwd) return null;
  const m = models[cwd];
  if (m && typeof m === 'object' && !Array.isArray(m)) return m[favKey(agentId)] ?? null;
  return favKey(agentId) === 'claude' ? (m ?? null) : null;
}
function setModelFor(agentId, v, cwd = current) {
  if (!cwd) return;
  const key = favKey(agentId);
  const cur = models[cwd];
  const obj =
    cur && typeof cur === 'object' && !Array.isArray(cur)
      ? { ...cur }
      : { claude: typeof cur === 'string' || cur === null || cur === undefined ? cur ?? null : null };
  obj[key] = v;
  models[cwd] = obj;
}
function modelLabelFor(agentId, v = modelFor(agentId)) {
  return agentById(agentId).models.find(([id]) => id === v)?.[1] ?? (v || 'Auto');
}
let claudeFound = true;
let cursorFound = true;
let geminiFound = false;
let muted = false;
let terminal = []; // sessions started in a terminal / Cursor IDE, reported by hooks
let focusSession = null; // observed session id pinned by tapping a session pill
let buddies = []; // bar + Home/Chat Nikki blobs; state syncs to all
const buddyEmit = (fn, ...args) => buddies.forEach((b) => b[fn]?.(...args));
const modelMenu = $('modelMenu');
const chatsMenu = $('chatsMenu');
const threadEl = $('thread');
const MAX_SESSION_PILLS = 2;
// Brand marks from Simple Icons (CC0); Git stays a simple branch glyph.
const ICON = {
  claude:
    '<svg class="agentIcon" viewBox="0 0 24 24" aria-hidden="true"><path d="m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z"/></svg>',
  cursor:
    '<svg class="agentIcon" viewBox="0 0 24 24" aria-hidden="true"><path d="M11.503.131 1.891 5.678a.84.84 0 0 0-.42.726v11.188c0 .3.162.575.42.724l9.609 5.55a1 1 0 0 0 .998 0l9.61-5.55a.84.84 0 0 0 .42-.724V6.404a.84.84 0 0 0-.42-.726L12.497.131a1.01 1.01 0 0 0-.996 0M2.657 6.338h18.55c.263 0 .43.287.297.515L12.23 22.918c-.062.107-.229.064-.229-.06V12.335a.59.59 0 0 0-.295-.51l-9.11-5.257c-.109-.063-.064-.23.061-.23"/></svg>',
  gemini:
    '<svg class="agentIcon" viewBox="0 0 24 24" aria-hidden="true"><path d="M11.04 19.32Q12 21.51 12 24q0-2.49.93-4.68.96-2.19 2.58-3.81t3.81-2.55Q21.51 12 24 12q-2.49 0-4.68-.93a12.3 12.3 0 0 1-3.81-2.58 12.3 12.3 0 0 1-2.58-3.81Q12 2.49 12 0q0 2.49-.96 4.68-.93 2.19-2.55 3.81a12.3 12.3 0 0 1-3.81 2.58Q2.49 12 0 12q2.49 0 4.68.96 2.19.93 3.81 2.55t2.55 3.81"/></svg>',
  git: '<svg class="agentIcon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="7" cy="6" r="2.2"/><circle cx="7" cy="18" r="2.2"/><circle cx="17" cy="8.5" r="2.2"/><path fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" d="M7 8.2v7.6M17 10.7c0 4-4.8 3.2-8.5 5.5"/></svg>',
  aistudio:
    '<svg class="agentIcon" viewBox="0 0 24 24" aria-hidden="true"><path d="M11.04 19.32Q12 21.51 12 24q0-2.49.93-4.68.96-2.19 2.58-3.81t3.81-2.55Q21.51 12 24 12q-2.49 0-4.68-.93a12.3 12.3 0 0 1-3.81-2.58 12.3 12.3 0 0 1-2.58-3.81Q12 2.49 12 0q0 2.49-.96 4.68-.93 2.19-2.55 3.81a12.3 12.3 0 0 1-3.81 2.58Q2.49 12 0 12q2.49 0 4.68.96 2.19.93 3.81 2.55t2.55 3.81"/></svg>',
};
// Extensible agent registry: add an entry here (+ backend in main) for more agents later.
const AGENTS = [
  {
    id: 'claude',
    label: 'Claude',
    title: 'Startet mit Claude Code (Abo-Login)',
    color: '#D97757',
    icon: 'claude',
    models: [
      [null, 'Standard'],
      ['opus', 'Opus'],
      ['sonnet', 'Sonnet'],
      ['haiku', 'Haiku'],
    ],
  },
  {
    id: 'cursor',
    label: 'Cursor',
    title: 'Startet mit Cursor Agent (Abo-Login)',
    color: '#f4f4f2',
    icon: 'cursor',
    // filled from `agent models` at startup (account-specific); fallback until then
    models: [
      [null, 'Auto'],
      ['composer-2.5', 'Composer 2.5'],
      ['grok-4.7-high', 'Grok 4.7 High'],
      ['gpt-5.5-medium', 'GPT-5.5'],
    ],
  },
  {
    id: 'gemini',
    label: 'AI Studio',
    title: 'Google Gemini CLI (Google-Login / AI Studio)',
    color: '#8E75B2',
    icon: 'gemini',
    inGrid: false, // chosen via AI Studio pill → Chat
    models: [
      [null, 'Auto'],
      ['gemini-2.5-pro', 'Gemini 2.5 Pro'],
      ['gemini-2.5-flash', 'Gemini 2.5 Flash'],
      ['gemini-3-pro-preview', 'Gemini 3 Pro'],
      ['gemini-3-flash-preview', 'Gemini 3 Flash'],
    ],
  },
];
// Coucou-style home pills that are not chat backends (local git + external tools)
const INTEGRATIONS = [
  {
    id: 'git',
    label: 'Git',
    title: 'Repo-Status · Tippen öffnet Remote im Browser',
    color: '#e86f4a',
    icon: 'git',
    kind: 'git',
  },
  {
    id: 'aistudio',
    label: 'AI Studio',
    title: 'Chat (Gemini CLI) oder Browser (aistudio.google.com)',
    color: '#8E75B2',
    icon: 'aistudio',
    kind: 'aistudio',
  },
];
const integMenu = $('integMenu');
let chatId = null;
let chatTitle = null; // custom name; null = derive from first user message
let chatMessages = []; // { role, text, at }[]
let chatsCache = [];
let lastChatId = null;
async function rememberLastChat(id) {
  lastChatId = id || null;
  await api.setLastChat?.(lastChatId);
}
const agentById = (id) => AGENTS.find((a) => a.id === id) ?? AGENTS[0];
const modelList = () => agentById(backend).models;
const agentLabel = () => agentById(backend).label;
let gitInfo = null; // last gitGlance for current project
let view = 'home';

function setView(name) {
  // Permission card lives in Chat — never leave Home while a prompt is waiting
  view = perms.length || name === 'chat' ? 'chat' : 'home';
  document.body.dataset.view = view;
  $('viewHome').hidden = view !== 'home';
  $('viewChat').hidden = view !== 'chat';
  for (const btn of document.querySelectorAll('#nav .navBtn')) {
    btn.setAttribute('aria-pressed', String(btn.dataset.view === view));
  }
  if (view === 'chat' && open) promptEl.focus();
}

function setMuted(v) {
  muted = !!v;
  $('muteBtn').setAttribute('aria-pressed', String(muted));
  $('muteBtn').title = muted ? 'Töne an' : 'Töne aus';
  $('muteBtn').setAttribute('aria-label', muted ? 'Töne an' : 'Töne aus');
}

function syncHome() {
  const s = shown();
  let title = agentLabel();
  if (s.observed) {
    const pinned = focusSession && terminal.find((t) => t.id === focusSession);
    const urgent = terminal.filter((t) => RANK[t.state]).sort((a, b) => RANK[b.state] - RANK[a.state])[0];
    const t = pinned || urgent;
    if (t) title = folderName(t.cwd) || title;
  }
  $('homeTitleText').textContent = title;
  const ready = !busy && !perms.length && !s.observed && (s.state === 'idle' || !s.state || s.state === 'done');
  $('homeSub').textContent = ready ? `${s.text || 'Nikki wartet…'} · Agent wählen.` : s.text || 'Nikki arbeitet…';
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
  if (busy || perms.length) return lastStatus;
  // folder lives on the session pill — don't repeat it in the status text
  if (focusSession) {
    const pinned = terminal.find((x) => x.id === focusSession);
    if (pinned) return { state: pinned.state, text: pinned.text, observed: true };
  }
  const t = terminal.filter((x) => RANK[x.state]).sort((a, b) => RANK[b.state] - RANK[a.state])[0];
  return t ? { state: t.state, text: t.text, observed: true } : lastStatus;
}
let shownState;
function renderState() {
  const s = shown();
  document.body.dataset.state = s.state;
  let text = s.text;
  if (s === lastStatus && s.state === 'done' && !open) text = 'Nikki fertig – tippen.';
  else if (!busy && !perms.length && !s.observed && (s.state === 'idle' || !s.state)) text = s.text || 'Nikki wartet…';
  $('statusText').textContent = text;
  if (s.state !== shownState) buddyEmit('setState', s.state);
  shownState = s.state;
  syncHome();
}

// ---- sounds: two short synthesized notes (no sound files): rising = done, falling = needs you
let audio;
function chime(kind) {
  if (muted) return;
  audio ??= new AudioContext();
  audio.resume();
  (kind === 'needsYou' ? [880, 660] : [660, 990]).forEach((freq, i) => {
    const t = audio.currentTime + i * 0.12;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.18, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    osc.connect(gain).connect(audio.destination);
    osc.start(t);
    osc.stop(t + 0.4);
  });
}

function show(s) {
  if (s.state !== lastStatus.state && (s.state === 'needsYou' || s.state === 'done')) chime(s.state);
  lastStatus = s;
  if (s.state === 'thinking') setStepLine(s.text || 'Nikki denkt…');
  else if (s.state === 'working') setStepLine(s.text || 'Nikki arbeitet…');
  else if (s.state === 'needsYou') setStepLine(s.text || 'Nikki braucht dich!');
  else if (s.state === 'done') setStepLine(STEP_IDLE);
  else if (s.state === 'error') setStepLine(s.text || 'Nikki stolpert.');
  else if (s.state === 'idle') setStepLine(busy ? 'Nikki stoppte.' : STEP_IDLE);
  if (s.turn?.assistant || s.turn?.user) {
    // intermediate Coucou choice round: keep Q&A in the thread before the next stream
    const prev = String(s.turn.assistant || '').trim();
    if (prev) chatMessages.push({ role: 'assistant', text: prev, at: Date.now() });
    const pick = String(s.turn.user || '').trim();
    if (pick) chatMessages.push({ role: 'user', text: pick, at: Date.now() });
    renderThread();
    persistChat();
  }
  if ('answer' in s) {
    if (busy && s.state !== 'done' && s.state !== 'error' && s.state !== 'idle') {
      // live stream; empty answer clears stale text after a choice follow-up
      if (String(s.answer || '').trim()) setAnswer(s.answer, '', { stream: true });
      else {
        answer.hidden = true;
        answer.textContent = '';
        delete answer.dataset.stream;
      }
    } else if ((s.state === 'done' || s.state === 'error') && busy) {
      // only commit into the chat thread during an active turn
      finalizeAssistant(s.answer);
    } else if (!busy) {
      // setup / soft errors: show in the pane, never poison chat history
      setAnswer(s.answer, s.state === 'error' ? 'error' : '');
    }
  }
  if (s.state === 'done' || s.state === 'error' || s.state === 'idle') {
    setBusy(false);
    refreshBranch(); // the task may have switched branches
    if (s.state === 'idle' || s.state === 'done') setStepLine(STEP_IDLE);
  }
  renderState();
}

function setStepLine(text) {
  const el = $('stepLine');
  if (!el) return;
  const next = (text && String(text).trim()) || STEP_IDLE;
  el.textContent = next;
  el.title = next;
  el.dataset.empty = String(next === STEP_IDLE);
}

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';
function reveal(el, from) {
  el.animate([{ opacity: 0, ...(!reduceMotion && from) }, { opacity: 1, transform: 'none', filter: 'none' }], { duration: 200, easing: EASE_OUT });
}
// Claude/Cursor often emit broken bold like `**1. **` — tidy before Markdown render.
function normalizeMarkdown(text) {
  return String(text ?? '')
    .replace(/\*\*([^*\n]*?)\s+\*\*/g, (_, inner) => `**${inner.trimEnd()}**`)
    .replace(/\*\*\s+([^*\n]*?)\*\*/g, (_, inner) => `**${inner.trimStart()}**`)
    .replace(/(^|\n)(\*\*\d+\.\*\*)\s*\n(?!\n)/g, '$1$2\n\n');
}
/** Missing space after punct + new line before the next sentence (not tiny abbrev. like Dr.). */
function softBreakSentences(text) {
  return String(text ?? '')
    .replace(/([.!?])([^\s\n.!?0-9])/g, '$1 $2')
    .replace(/(?<=[a-zäöüß]{2,})([.!?])[ \t]+([A-ZÄÖÜ])/g, '$1\n\n$2');
}
function prepareMd(text) {
  return normalizeMarkdown(softBreakSentences(text));
}
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
  threadEl.replaceChildren(
    ...chatMessages.map((m) => {
      const div = document.createElement('div');
      div.className = `msg msg-${m.role === 'user' ? 'user' : 'assistant'}`;
      if (m.role === 'assistant') {
        div.classList.add('md');
        div.innerHTML = md(m.text);
      } else div.textContent = m.text;
      return div;
    }),
  );
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
    cwd: current || '',
    backend,
    sessionId: chatSessionId,
    title: title.slice(0, 80),
    messages: chatMessages,
  })) || chatsCache;
  await rememberLastChat(chatId);
  syncChatsBtn();
}
async function renameSavedChat(c, name) {
  const title = String(name || '').trim().slice(0, 80);
  if (!c?.id || !title) return;
  chatsCache =
    (await api.chatsSave?.({
      ...c,
      title,
      messages: c.messages || [],
    })) || chatsCache;
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
  const pretty = normalizeMarkdown(raw);
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
      ? `Sag mir, was ${agentLabel()} in ${folderName(current)} tun soll.`
      : 'Wähl auf Home ein Projekt, dann leg los.',
    'empty',
  );
}
function beginChatTurn(userText) {
  if (!chatId) chatId = newChatId();
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
      b.children[1].textContent = `${agentById(c.backend).label}${when ? ` · ${when}` : ''}`;
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
  const finish = async (save) => {
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
  chatSessionId = c.sessionId || null;
  turnFinalized = true;
  if (c.cwd && projects.includes(c.cwd)) selectProject(c.cwd);
  else if (c.cwd) {
    current = c.cwd;
    $('projectName').textContent = folderName(c.cwd);
    refreshBranch();
  }
  if (c.backend) setBackend(c.backend);
  // Resume only this chat's session id (not the latest project session)
  setNewSession(!chatSessionId);
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
  // lock agent/model switching while a task runs (stop still works)
  if (b) {
    closeModelMenu();
    closeIntegMenu();
    closeChatsMenu();
    closeMenu();
  }
  renderAgentGrid();
  $('projectBtn')?.toggleAttribute('disabled', b);
  $('chatsBtn')?.toggleAttribute('disabled', b);
  $('newBtn')?.toggleAttribute('disabled', b);
}

// Animated when clicked; instant when opened from the keyboard or tray (opened many times a day).
function setOpen(v, { instant = false } = {}) {
  if (v === open) return;
  open = v;
  if (instant) {
    island.classList.add('instant');
    requestAnimationFrame(() => requestAnimationFrame(() => island.classList.remove('instant')));
  }
  island.classList.toggle('open', v);
  $('pill').setAttribute('aria-expanded', String(v));
  renderState();
  if (!v) {
    closeMenu();
    closeModelMenu();
    closeChatsMenu();
    closeIntegMenu();
  }
  if (v) {
    api.focus();
    if (view === 'chat') promptEl.focus();
  }
}

// ---- git glance of the selected project (polled; local only — no GitHub OAuth)
function gitSubLabel(g) {
  if (!g) return current ? 'kein Repo' : 'Projekt wählen';
  const bits = [];
  if (g.dirty) bits.push(`${g.dirty} dirty`);
  else bits.push('clean');
  if (g.ahead) bits.push(`↑${g.ahead}`);
  if (g.behind) bits.push(`↓${g.behind}`);
  if (g.prs != null && g.prs > 0) bits.push(`${g.prs} PR`);
  return bits.join(' · ');
}
function syncGitPill() {
  const pill = document.querySelector('#agentGrid .agentPill[data-agent="git"]');
  if (!pill) return;
  const sub = pill.querySelector('.sub');
  if (sub) sub.textContent = gitSubLabel(gitInfo);
  pill.title = gitInfo
    ? `${gitInfo.branch}${gitInfo.remoteUrl ? `\n${gitInfo.remoteUrl}` : ''}\n${gitSubLabel(gitInfo)}`
    : current
      ? 'Kein Git-Repo in diesem Ordner'
      : 'Zuerst ein Projekt wählen';
}
async function refreshBranch() {
  gitInfo = current ? await api.gitStatus(current) : null;
  const name = gitInfo?.branch ?? null;
  $('branch').hidden = $('cardBranch').hidden = !name;
  const line = name ? (gitInfo.dirty ? `${name} · ${gitInfo.dirty}Δ` : name) : '';
  $('branchName').textContent = $('cardBranchName').textContent = line;
  $('branch').title = gitInfo
    ? `Branch: ${gitInfo.branch} · ${gitSubLabel(gitInfo)}`
    : '';
  syncGitPill();
}
setInterval(() => document.visibilityState === 'visible' && refreshBranch(), 4000);

async function onGitPill() {
  if (!current) {
    await pickFolder();
    return;
  }
  await refreshBranch();
  if (!gitInfo) {
    $('homeSub').textContent = 'kein Git-Repo hier';
    return;
  }
  $('homeSub').textContent = `${gitInfo.branch} · ${gitSubLabel(gitInfo)}`;
  if (gitInfo.remoteUrl) {
    const r = await api.gitOpenRemote(current);
    if (r?.ok) $('homeSub').textContent = `Remote geöffnet · ${gitSubLabel(gitInfo)}`;
  }
}

function closeIntegMenu() {
  if (!integMenu || integMenu.hidden) return;
  integMenu.hidden = true;
}

function openAiStudioMenu() {
  if (!integMenu) return;
  const chatBtn = document.createElement('button');
  chatBtn.type = 'button';
  chatBtn.role = 'menuitem';
  chatBtn.innerHTML = '<strong>Im Chat nutzen</strong><span class="hint"></span>';
  chatBtn.querySelector('.hint').textContent = geminiFound
    ? 'Gemini CLI · Google-Login'
    : 'Gemini CLI fehlt — tippen für Hinweis';
  chatBtn.addEventListener('click', () => {
    closeIntegMenu();
    if (!geminiFound) {
      setView('chat');
      setOpen(true);
      show({ state: 'error', text: 'Nikki braucht Gemini.' });
      setAnswer(
        'Für Chat: `npm i -g @google/gemini-cli`, dann einmal `gemini` im Terminal und mit Google anmelden (oder AI-Studio-Key). Danach hier erneut „Im Chat nutzen“.',
        'error',
      );
      return;
    }
    setBackend('gemini');
    setView('chat');
    setOpen(true);
    $('homeSub').textContent = 'AI Studio · Chat bereit';
  });

  const browserBtn = document.createElement('button');
  browserBtn.type = 'button';
  browserBtn.role = 'menuitem';
  browserBtn.innerHTML = '<strong>Im Browser öffnen</strong><span class="hint">aistudio.google.com · Prompt optional kopieren</span>';
  browserBtn.addEventListener('click', async () => {
    closeIntegMenu();
    const text = promptEl.value.trim();
    const r = await api.openAiStudio(text || undefined);
    $('homeSub').textContent = r?.copied
      ? 'Prompt kopiert · AI Studio öffnet…'
      : 'Google AI Studio öffnet…';
  });

  integMenu.replaceChildren(chatBtn, browserBtn);
  integMenu.hidden = false;
  // sit above the AI Studio pill (hochgezogen), not under the island edge
  const pill = document.querySelector('#agentGrid .agentPill[data-kind="aistudio"]');
  const wrap = integMenu.offsetParent || $('homeAgents');
  if (pill && wrap) {
    const pr = pill.getBoundingClientRect();
    const wr = wrap.getBoundingClientRect();
    integMenu.style.right = 'auto';
    integMenu.style.left = `${Math.max(4, pr.right - wr.left - 210)}px`;
    integMenu.style.bottom = `${Math.max(4, wr.bottom - pr.top + 6)}px`;
    integMenu.style.top = 'auto';
  }
  chatBtn.focus();
}

function onAiStudioPill() {
  if (integMenu && !integMenu.hidden) closeIntegMenu();
  else openAiStudioMenu();
}

// ---- projects
function selectProject(p) {
  if (busy) return;
  current = p;
  $('projectName').textContent = p ? folderName(p) : 'Projekt wählen';
  $('projectBtn').title = p ?? '';
  setBackend(backends[p] ?? 'claude');
  setModel(modelFor(backend, p));
  renderAgentGrid();
  if (!answer.textContent.trim() || answer.classList.contains('empty')) setEmptyAnswer();
  refreshBranch();
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
// ---- agent pills on Home (remembered per project) + observed session pills
function agentAvailable(id) {
  if (id === 'claude') return claudeFound;
  if (id === 'cursor') return cursorFound;
  if (id === 'gemini') return geminiFound;
  return true;
}

function syncAiStudioPill() {
  const pill = document.querySelector('#agentGrid .agentPill[data-kind="aistudio"]');
  if (!pill) return;
  const on = backend === 'gemini';
  pill.setAttribute('aria-selected', String(on));
  const sub = pill.querySelector('.sub');
  if (sub) sub.textContent = on ? 'aktiv · Chat' : 'Chat oder Browser';
}

function renderAgentGrid() {
  const box = $('agentGrid');
  if (!box) return;
  const agentBtns = AGENTS.filter((a) => a.inGrid !== false).map((a) => {
    const ok = agentAvailable(a.id);
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'agentPill';
    b.role = 'option';
    b.dataset.agent = a.id;
    b.dataset.kind = 'agent';
    b.style.setProperty('--agent', a.color);
    b.title = ok ? a.title : `${a.label} nicht gefunden`;
    b.setAttribute('aria-selected', String(a.id === backend));
    b.setAttribute('aria-disabled', String(!ok || busy));
    b.innerHTML = `<span class="iconWrap" aria-hidden="true">${ICON[a.icon] || ICON.claude}</span><span class="label"></span><span class="sub"></span><button type="button" class="modelChip"></button>`;
    b.querySelector('.label').textContent = a.label;
    b.querySelector('.sub').textContent = !ok
      ? 'nicht installiert'
      : busy
        ? a.id === backend
          ? 'läuft…'
          : 'gesperrt'
        : a.id === backend
          ? 'aktiv'
          : 'auswählen';
    const chip = b.querySelector('.modelChip');
    chip.textContent = ok ? `Modell · ${modelLabelFor(a.id)}` : '—';
    chip.disabled = !ok || busy;
    chip.title = busy ? 'Während Nikki arbeitet gesperrt' : 'Modell für diese KI wählen';
    chip.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!ok || busy) return;
      closeIntegMenu();
      if (!modelMenu.hidden && modelMenuFor === a.id) closeModelMenu();
      else openModelMenu(a.id);
    });
    b.addEventListener('click', (e) => {
      if (e.target.closest('.modelChip')) return;
      e.stopPropagation();
      closeIntegMenu();
      closeModelMenu();
      if (!ok || busy) return;
      setBackend(a.id); // stay on Home — Chat nur über Nav / Senden
    });
    return b;
  });
  const integBtns = INTEGRATIONS.map((a) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'agentPill';
    b.role = 'option';
    b.dataset.agent = a.id;
    b.dataset.kind = a.kind;
    b.style.setProperty('--agent', a.color);
    b.title = a.title;
    b.setAttribute('aria-selected', String(a.kind === 'aistudio' && backend === 'gemini'));
    b.setAttribute('aria-disabled', 'false');
    b.innerHTML = `<span class="iconWrap" aria-hidden="true">${ICON[a.icon] || ICON.git}</span><span class="label"></span><span class="sub"></span>`;
    b.querySelector('.label').textContent = a.label;
    b.querySelector('.sub').textContent =
      a.kind === 'git' ? gitSubLabel(gitInfo) : backend === 'gemini' ? 'aktiv · Chat' : 'Chat oder Browser';
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      if (a.kind === 'git') {
        closeIntegMenu();
        onGitPill();
      } else if (a.kind === 'aistudio') onAiStudioPill();
    });
    return b;
  });
  box.replaceChildren(...agentBtns, ...integBtns);
  syncGitPill();
  syncAiStudioPill();
}

function setBackend(id) {
  if (busy) return;
  const next = agentById(id).id;
  backend = next;
  if (current) backends[current] = backend;
  for (const btn of document.querySelectorAll('#agentGrid .agentPill[data-kind="agent"]')) {
    const on = btn.dataset.agent === backend;
    btn.setAttribute('aria-selected', String(on));
    const sub = btn.querySelector('.sub');
    if (sub && btn.getAttribute('aria-disabled') !== 'true') sub.textContent = on ? 'aktiv' : 'auswählen';
    const chip = btn.querySelector('.modelChip');
    if (chip && btn.getAttribute('aria-disabled') !== 'true') chip.textContent = `Modell · ${modelLabelFor(btn.dataset.agent)}`;
  }
  syncAiStudioPill();
  promptEl.placeholder = plan ? `Was soll ${agentLabel()} planen?` : `Was soll ${agentLabel()} tun?`;
  const saved = modelFor(backend);
  if (!modelList().some(([v]) => v === saved)) setModel(null);
  else setModel(saved);
  if (!busy && (!answer.textContent.trim() || answer.classList.contains('empty'))) setEmptyAnswer();
  renderState();
}

function renderSessionPills() {
  const box = $('sessionPills');
  if (!box) return;
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
      b.className = 'sessionPill';
      b.dataset.state = t.state;
      b.setAttribute('aria-pressed', String(t.id === focusSession));
      const src = t.source === 'cursor' ? 'Cur' : 'Cld';
      b.title = `beobachtet ${src}: ${t.cwd}\n${t.text}`;
      b.innerHTML = '<span class="spDot"></span><span class="spLabel"></span>';
      b.lastChild.textContent = folderName(t.cwd) || src;
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        focusSession = focusSession === t.id ? null : t.id;
        renderSessionPills();
        renderState();
        if (focusSession) {
          setView('chat');
          setOpen(true);
        }
      });
      return b;
    }),
  );
}
function setModel(m) {
  model = m;
  if (current) {
    setModelFor(backend, m, current);
    api.setModel?.(current, backend, m);
  }
  const chip = document.querySelector(`#agentGrid .agentPill[data-agent="${backend}"] .modelChip`);
  if (chip) chip.textContent = `Modell · ${modelLabelFor(backend, m)}`;
}

function modelsForAgent(agentId) {
  return agentById(agentId).models;
}

function sortedModels(agentId = modelMenuFor) {
  const list = modelsForAgent(agentId);
  const favs = favList(agentId);
  if (!favs.length) return { fav: [], rest: list };
  const fav = [];
  const rest = [];
  for (const row of list) (isFav(row[0], agentId) ? fav : rest).push(row);
  fav.sort((a, b) => favs.indexOf(favId(a[0])) - favs.indexOf(favId(b[0])));
  return { fav, rest };
}

function modelRow([v, label], agentId) {
  const selected = modelFor(agentId);
  const row = document.createElement('div');
  row.className = 'modelRow';
  const star = document.createElement('button');
  star.type = 'button';
  star.className = 'star';
  star.title = isFav(v, agentId) ? 'Favorit entfernen' : 'Als Favorit';
  star.setAttribute('aria-label', star.title);
  star.setAttribute('aria-pressed', String(isFav(v, agentId)));
  star.innerHTML = STAR;
  star.addEventListener('click', async (e) => {
    e.stopPropagation();
    favorites = (await api.toggleFavorite(agentId, favId(v))) || favorites;
    openModelMenu(agentId);
  });
  const pick = document.createElement('button');
  pick.type = 'button';
  pick.className = 'pick';
  pick.role = 'menuitemradio';
  pick.setAttribute('aria-checked', String(v === selected));
  pick.title = v ?? 'auto';
  pick.textContent = label;
  pick.addEventListener('click', () => {
    setBackend(agentId);
    setModel(v);
    closeModelMenu();
  });
  row.append(star, pick);
  return row;
}

function openModelMenu(agentId = backend) {
  if (busy) return;
  modelMenuFor = favKey(agentId);
  const { fav, rest } = sortedModels(modelMenuFor);
  const nodes = [];
  for (const row of fav) nodes.push(modelRow(row, modelMenuFor));
  if (fav.length && rest.length) {
    const hr = document.createElement('hr');
    hr.className = 'favSep';
    nodes.push(hr);
  }
  for (const row of rest) nodes.push(modelRow(row, modelMenuFor));
  modelMenu.replaceChildren(...nodes);
  modelMenu.hidden = false;
  modelMenu.querySelector('[aria-checked="true"]')?.focus();
}

function applyCursorModels(list) {
  if (!Array.isArray(list) || !list.length) return;
  const cursor = AGENTS.find((a) => a.id === 'cursor');
  if (!cursor) return;
  cursor.models = list.map(([id, label]) => [id ?? null, label || id || 'Auto']);
  if (backend === 'cursor') {
    const saved = modelFor('cursor');
    if (!modelsForAgent('cursor').some(([v]) => v === saved)) setModel(null);
    else setModel(saved);
  }
  renderAgentGrid();
}
function closeModelMenu() {
  if (!modelMenu || modelMenu.hidden) return;
  modelMenu.hidden = true;
}

async function pickFolder() {
  const p = await api.pickFolder();
  if (!p) return null;
  projects = (await api.getState()).projects;
  selectProject(p);
  return p;
}

// ---- run
async function start() {
  const text = promptEl.value.trim();
  if (!text || busy) return;
  const cwd = current || (await pickFolder());
  if (!cwd) return;
  if (backend === 'claude' && !claudeFound) {
    show({ state: 'error', text: 'Nikki findet Claude nicht.' });
    setAnswer('Installier Claude Code und melde dich einmal mit „claude“ im Terminal an.', 'error');
    return;
  }
  if (backend === 'cursor' && !cursorFound) {
    show({ state: 'error', text: 'Nikki findet Cursor nicht.' });
    setAnswer('Installier die Cursor CLI und melde dich mit „agent login“ an.', 'error');
    return;
  }
  if (backend === 'gemini' && !geminiFound) {
    show({ state: 'error', text: 'Nikki braucht Gemini.' });
    setAnswer('Installier `npm i -g @google/gemini-cli` und melde dich einmal mit „gemini“ an.', 'error');
    return;
  }
  setBusy(true);
  setView('chat');
  setStepLine('Nikki startet…');
  show({ state: 'thinking', text: 'Nikki startet…' });
  const resumeId = newSession ? undefined : chatSessionId || undefined;
  if (!(await api.start(text, cwd, { newSession, plan, model, backend, sessionId: resumeId }))) {
    setBusy(false);
    show({ state: 'error', text: 'Nikki kommt nicht los.' });
    setAnswer('Der Start ist fehlgeschlagen. Läuft schon eine Aufgabe, oder existiert der Ordner nicht mehr?', 'error');
    return;
  }
  setModelFor(backend, model, cwd);
  backends[cwd] = backend;
  if (newSession) {
    chatId = newChatId();
    chatTitle = null;
    chatMessages = [];
    chatSessionId = null;
  }
  beginChatTurn(text);
  setNewSession(false);
  setPlan(false);
  promptEl.value = '';
  delete answer.dataset.observed;
}
function setNewSession(v) {
  newSession = v;
  $('newBtn').setAttribute('aria-pressed', String(v));
  if (v && !busy) {
    chatId = newChatId();
    chatTitle = null;
    chatMessages = [];
    chatSessionId = null;
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
  promptEl.placeholder = v ? `Was soll ${agentLabel()} planen?` : `Was soll ${agentLabel()} tun?`;
}

// ---- permissions, questions (AskUserQuestion) and plans (ExitPlanMode) share one card
function detail(input = {}) {
  return String(input.command ?? input.file_path ?? input.url ?? JSON.stringify(input, null, 2)).slice(0, 800);
}
function button(label, cls, onClick) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = cls;
  b.textContent = label;
  b.addEventListener('click', onClick);
  return b;
}
function field(tag, placeholder) {
  const el = document.createElement(tag);
  el.className = 'other';
  el.placeholder = el.ariaLabel = placeholder;
  if (tag === 'textarea') el.rows = 1;
  return el;
}
function renderPerm() {
  const r = perms[0];
  const wasHidden = $('permission').hidden;
  $('permission').hidden = !r;
  const body = $('permBody');
  if (!r) {
    body?.classList.remove('choiceRow');
    return;
  }
  if (wasHidden) reveal($('permission'), { transform: 'translateY(4px)' });
  $('output').scrollTop = 0;
  if (r.toolName === 'AskUserQuestion') return renderQuestion(r);
  body.classList.remove('choiceRow');
  if (r.toolName === 'ExitPlanMode') return renderPlan(r);
  $('permTitle').textContent = r.title ?? `${r.toolName} ausführen?`;
  const code = document.createElement('code');
  code.className = 'detail';
  code.textContent = detail(r.input);
  body.replaceChildren(code);
  // Coucou order: Deny · Allow (white) · Always
  $('permActions').replaceChildren(
    button('Ablehnen', 'ghost', () => answerPerm({ answer: 'deny' })),
    button('Erlauben', 'primary', () => answerPerm({ answer: 'allow' })),
    button('Immer', 'soft', () => answerPerm({ answer: 'always' })),
  );
}

// one question at a time; a single-choice click answers it, multi-choice needs "Weiter"
let asked = null; // { id, i, picks } for the request on screen
function renderQuestion(r) {
  const qs = r.input.questions ?? [];
  if (!qs.length) {
    $('permTitle').textContent = r.title || 'Auswahl';
    $('permBody').replaceChildren();
    $('permActions').replaceChildren(button('Schließen', 'ghost', () => answerPerm({ answer: 'deny' })));
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
  const options = opts.map((o) => {
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
    return b;
  });
  $('permTitle').textContent = qs.length > 1 ? `${qText} (${asked.i + 1}/${qs.length})` : qText;
  const body = $('permBody');
  body.classList.toggle('choiceRow', opts.length === 2 && opts.every((o) => !(o.description)));
  body.replaceChildren(...options, other);
  $('permActions').replaceChildren(
    button('Überspringen', 'ghost', () => answerPerm({ answer: 'deny', message: 'Der Nutzer wollte die Frage nicht beantworten.' })),
    ...(q.multiSelect ? [button('Weiter', 'primary', () => next([...chosen, ...typed()]))] : []),
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
    button('Ablehnen', 'ghost', () => answerPerm({ answer: 'deny', message: why.value.trim() || 'Plan abgelehnt, bitte überarbeiten.' })),
    button('Annehmen', 'primary', () => answerPerm({ answer: 'allow' })),
  );
}

function answerPerm(a) {
  const r = perms.shift();
  if (!r) return;
  api.answerPermission(r.id, a);
  renderPerm();
  if (!perms.length) show({ state: 'working', text: a.answer === 'deny' ? 'Nikki macht weiter…' : 'Nikki macht weiter…' });
}

// ---- terminal sessions: bar pills only (no Beobachtet list in chat)
function renderTerminal() {
  if (focusSession && !terminal.some((t) => t.id === focusSession)) focusSession = null;
  renderSessionPills();
  renderState();
}

// ---- drop files onto the island: their quoted paths go into the prompt
document.addEventListener('dragover', (e) => {
  e.preventDefault();
  island.classList.toggle('drop', !!e.target.closest?.('.hit'));
});
document.addEventListener('dragleave', (e) => !e.relatedTarget && island.classList.remove('drop'));
document.addEventListener('drop', (e) => {
  e.preventDefault();
  island.classList.remove('drop');
  const paths = [...e.dataTransfer.files].map((f) => api.pathForFile(f)).filter(Boolean);
  if (!paths.length || !e.target.closest?.('.hit')) return;
  setOpen(true);
  setView('chat');
  promptEl.focus();
  const before = promptEl.value.slice(0, promptEl.selectionStart);
  const text = paths.map((p) => `"${p}"`).join(' ');
  promptEl.setRangeText(`${before && !/\s$/.test(before) ? ' ' : ''}${text} `, promptEl.selectionStart, promptEl.selectionEnd, 'end');
});

// ---- wiring
$('bar').addEventListener('click', (e) => {
  if (e.target.closest('.iconBtn, .navBtn, .sessionPill, #nav, #sessionPills, #barActions')) return;
  setOpen(!open);
});
$('nav').addEventListener('click', (e) => {
  const btn = e.target.closest('.navBtn');
  if (!btn) return;
  e.stopPropagation();
  setView(btn.dataset.view);
  if (!open) setOpen(true);
});
$('muteBtn').addEventListener('click', (e) => {
  e.stopPropagation();
  api.setMuted(!muted);
});
$('newBtn').addEventListener('click', () => setNewSession(!newSession));
$('planBtn').addEventListener('click', () => setPlan(!plan));
$('projectBtn').addEventListener('click', () => (menu.hidden ? openMenu() : closeMenu()));
$('chatsBtn')?.addEventListener('click', (e) => {
  e.stopPropagation();
  if (chatsMenu && !chatsMenu.hidden) closeChatsMenu();
  else openChatsMenu();
});
$('agentGrid').addEventListener('keydown', (e) => {
  const pills = [...$('agentGrid').querySelectorAll('.agentPill[data-kind="agent"]:not([aria-disabled="true"])')];
  const i = pills.findIndex((t) => t.dataset.agent === backend);
  if (i < 0) return;
  let next = -1;
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % pills.length;
  if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (i - 1 + pills.length) % pills.length;
  if (e.key === 'Home') next = 0;
  if (e.key === 'End') next = pills.length - 1;
  if (next < 0 || busy) return;
  e.preventDefault();
  e.stopPropagation();
  setBackend(pills[next].dataset.agent);
  pills[next].focus();
});
document.addEventListener('click', (e) => {
  if (!e.target.closest('.projectWrap')) closeMenu();
  if (!e.target.closest('.chatsWrap')) closeChatsMenu();
  if (!e.target.closest('.homeAgents')) {
    closeIntegMenu();
    closeModelMenu();
  } else if (!e.target.closest('#modelMenu, .modelChip')) {
    closeModelMenu();
  }
  const link = e.target.closest('a[href]');
  if (link) {
    e.preventDefault();
    api.openExternal(link.href);
  }
});
$('composer').addEventListener('submit', (e) => {
  e.preventDefault();
  busy ? api.stop() : start();
});
promptEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    if (busy) api.stop();
    else start();
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
  } else if (integMenu && !integMenu.hidden) {
    closeIntegMenu();
  } else setOpen(false);
});

api.onToggle(() => setOpen(!open, { instant: true }));
api.onShow?.(() => setOpen(true, { instant: true }));
api.onStatus(show);
api.onSession?.(({ id }) => {
  if (!id) return;
  chatSessionId = id;
  if (chatId) persistChat();
});
api.onCursor(({ x, y }) => {
  buddyEmit('lookAt', x, y);
  // also during a drag from Explorer, where no mousemove arrives: catch the drop only over the island
  setThrough(!document.elementFromPoint(x, y)?.closest('.hit'));
});
api.onMuted(setMuted);
api.onTerminal(({ sessions, changed }) => {
  terminal = sessions;
  renderTerminal();
  if (changed === 'needsYou' || changed === 'done') chime(changed);
});
api.onPermissionRequest((r) => {
  perms.push(r);
  renderPerm();
  setView('chat');
  setOpen(true);
  const text =
    r.toolName === 'AskUserQuestion'
      ? 'Nikki fragt dich!'
      : r.toolName === 'ExitPlanMode'
        ? 'Nikki zeigt Plan!'
        : 'Nikki will OK!';
  show({ state: 'needsYou', text });
});
api.onPermissionCancel((id) => {
  perms = perms.filter((p) => p.id !== id);
  if (asked?.id === id) asked = null;
  renderPerm();
  if (!perms.length && lastStatus.state === 'needsYou') show({ state: 'working', text: 'Nikki macht weiter…' });
});

(async () => {
  const bar = createCompanion({ walker: $('walker'), stage: $('stage'), island, mode: 'bar' });
  mountNikkiBlob($('homeWalker'));
  mountNikkiBlob($('chatWalker'));
  const home = createCompanion({ walker: $('homeWalker'), stage: $('homeStage'), island, mode: 'blob' });
  const chat = createCompanion({ walker: $('chatWalker'), stage: $('chatStage'), island, mode: 'blob', pinned: true });
  buddies = [bar, home, chat];

  const state = await api.getState();
  projects = state.projects;
  models = state.models ?? {};
  backends = state.backends ?? {};
  favorites = {
    claude: state.favorites?.claude ?? [],
    cursor: state.favorites?.cursor ?? [],
    gemini: state.favorites?.gemini ?? [],
  };
  terminal = state.terminal;
  lastChatId = state.lastChatId ?? null;
  claudeFound = state.claudeFound;
  cursorFound = state.cursorFound;
  geminiFound = !!state.geminiFound;
  applyCursorModels(state.cursorModels);
  setMuted(state.muted);
  setView('home');
  renderAgentGrid();
  selectProject(projects[0] ?? null);
  renderTerminal();
  // restore last conversation into Chat (stay on Home until user opens it)
  try {
    chatsCache = (await api.chatsList?.()) || [];
    const last = chatsCache.find((c) => c.id === lastChatId) || chatsCache[0];
    if (last) loadChat(last, { activate: false });
    else syncChatsBtn();
  } catch {
    syncChatsBtn();
  }
  // refresh model list in the background (CLI can be slow the first time)
  if (cursorFound) api.cursorModels?.().then(applyCursorModels).catch(() => {});
  if (!claudeFound && !cursorFound) {
    show({ state: 'error', text: 'Nikki braucht einen Agenten.' });
    setAnswer('Installier Claude Code („claude“) und/oder die Cursor CLI („agent login“).', 'error');
  } else if (!claudeFound && backend === 'claude') {
    show({ state: 'error', text: 'Nikki findet Claude nicht.' });
    setAnswer('Installier Claude Code und melde dich einmal mit „claude“ im Terminal an — oder wechsle zu Cursor.', 'error');
  }
})();
