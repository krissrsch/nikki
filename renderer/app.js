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
let terminal = []; // Claude Code sessions started in a terminal, reported by hooks
let focusSession = null; // observed session id pinned by tapping a session pill
let buddies = []; // bar + Home/Chat Nikki blobs; state syncs to all
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
  let title = 'Claude';
  if (s.observed) {
    const pinned = focusSession && terminal.find((t) => t.id === focusSession);
    const urgent = terminal.filter((t) => RANK[t.state]).sort((a, b) => RANK[b.state] - RANK[a.state])[0];
    const t = pinned || urgent;
    if (t) title = folderName(t.cwd) || title;
  }
  $('homeTitleText').textContent = title;
  const ready = !busy && !perms.length && !s.observed && (s.state === 'idle' || !s.state || s.state === 'done');
  $('homeSub').textContent = ready ? s.text || 'Nikki wartet…' : s.text || 'Nikki arbeitet…';
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
    if (s.state === 'idle' || s.state === 'done') setStepLine(STEP_IDLE);
    if (wasBusy) sendPlanFeedback();
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
  }
  if (v) {
    api.focus();
    if (view === 'chat') promptEl.focus();
  }
}

// ---- branch of the selected project: on project switch and turn end only, no polling (M12)
async function refreshBranch() {
  const cwd = current;
  const name = cwd ? await api.branch(cwd).catch(() => null) : null;
  if (cwd !== current) return; // the project changed while git ran
  $('branch').hidden = $('cardBranch').hidden = !name;
  $('branchName').textContent = $('cardBranchName').textContent = name || '';
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
// ---- observed session pills

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
      b.title = `beobachtet: ${t.cwd}\n${t.text}`;
      b.innerHTML = '<span class="spDot"></span><span class="spLabel"></span>';
      b.lastChild.textContent = folderName(t.cwd);
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
async function start() {
  const text = promptEl.value.trim();
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
  go.disabled = !!r; // stop is locked while a card waits (B6)
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
    button('Ablehnen', 'ghost', () => {
      const wish = why.value.trim();
      if (!wish) return answerPerm({ answer: 'deny', message: 'Plan abgelehnt, bitte überarbeiten.' });
      // a deny message reads like a tool error to the agent; the same words follow as a real user prompt
      planFeedback = wish;
      answerPerm({
        answer: 'deny',
        interrupt: true,
        message: `Plan abgelehnt. Der Nutzer möchte: „${wish}“. Er schickt dir das gleich als eigene Nachricht. Beende deinen Zug jetzt ohne weitere Schritte.`,
      });
    }),
    button('Annehmen', 'primary', () => answerPerm({ answer: 'allow' })),
  );
}

function answerPerm(a) {
  const r = perms.shift();
  if (!r) return;
  api.answerPermission(r.id, a);
  renderPerm();
  if (!perms.length) show({ state: 'working', text: 'Nikki macht weiter…' });
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
api.onPointer(({ x, y }) => {
  // boot: click-through ON — capturing the top strip made the mouse feel stuck
  if (island.classList.contains('spawning') || island.classList.contains('settling')) {
    setThrough(true);
    return;
  }
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

const waitMs = (ms) => new Promise((r) => setTimeout(r, ms));

/** Slide Nikki's stage from center → home slot (horizontal only — vertical FLIP felt jumpy). */
function settleStageHome(stageEl, home) {
  if (reduceMotion || !stageEl) {
    gsap.set(stageEl, { clearProps: 'transform' });
    return home.walkToHome?.() ?? Promise.resolve();
  }
  const start = stageEl.getBoundingClientRect();
  island.classList.remove('spawning');
  island.classList.add('settling');
  void island.offsetWidth;
  const end = stageEl.getBoundingClientRect();
  const dx = start.left - end.left;
  gsap.set(stageEl, { x: dx, y: 0, transformOrigin: '50% 100%' });
  home.walkToHome?.();
  return new Promise((resolve) => {
    gsap.to(stageEl, {
      x: 0,
      duration: 0.45,
      ease: 'power2.inOut',
      onComplete: () => {
        gsap.set(stageEl, { clearProps: 'transform' });
        resolve();
      },
    });
  });
}

/** Launch: open → CSS flash + drop + meow → home slot. Canvas particles removed (stalled the mouse). */
async function runBootIntro(home) {
  island.classList.add('spawning');
  setThrough(true); // never steal the mouse during boot
  setOpen(true, { instant: true });
  island.classList.remove('boot');
  const finish = async () => {
    if (reduceMotion) {
      await home.playIntro?.({ onLand: meow });
      island.classList.remove('spawning');
      island.classList.add('settling');
      await home.walkToHome?.();
      return;
    }
    await waitMs(180);
    await home.playIntro?.({ onLand: meow });
    await settleStageHome($('homeStage'), home);
  };
  // GSAP/rAF freeze while the window is hidden (fullscreen game) — don't hang in spawning forever
  await Promise.race([finish(), waitMs(2200)]);
  home.walkToHome?.();
  home.settleIdle?.();
}

(async () => {
  const bar = createCompanion({ walker: $('walker'), stage: $('stage'), island, mode: 'bar', hold: true });
  mountNikkiBlob($('homeWalker'));
  mountNikkiBlob($('chatWalker'));
  const home = createCompanion({ walker: $('homeWalker'), stage: $('homeStage'), island, mode: 'blob', hold: true });
  // hold chat too — idle GSAP on a hidden walker stole frames during boot
  const chat = createCompanion({ walker: $('chatWalker'), stage: $('chatStage'), island, mode: 'blob', pinned: true, hold: true });
  buddies = [bar, home, chat];

  setView('home');
  const state = await api.getState();
  setMuted(state.muted); // before intro meow so mute is respected
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

  // main keeps the window hidden while a fullscreen app runs: play the intro once it can be seen
  while (document.visibilityState !== 'visible') await new Promise((r) => document.addEventListener('visibilitychange', r, { once: true }));
  await runBootIntro(home);
  island.classList.remove('spawning', 'settling'); // cards + copy fade in via CSS transition
  await waitMs(reduceMotion ? 0 : 480);
  bar.release?.();
  chat.release?.();

  if (!claudeFound) {
    show({ state: 'error', text: 'Nikki findet Claude nicht.' });
    setAnswer('Installier Claude Code und melde dich einmal mit „claude“ im Terminal an.', 'error');
  }
})();
