// Spracheingabe (notes/plan/sprache.plan.md): what is downloaded, which key is held, and what a transcript means. main does the rest.

// whisper.cpp and its model, pinned: nothing else is ever downloaded or run. large-v3-turbo (5-bit) hears German far better than the base model Nikki started with.
export const VOICE_ASSETS = [
  { file: 'whisper.zip', size: 8194445, sha256: '49dcc16de826f20bd53d44f947a1ae49dfa81f86cad67a64d80820cb192d674a', url: 'https://github.com/ggml-org/whisper.cpp/releases/download/v1.9.2/whisper-bin-x64.zip' },
  { file: 'ggml-large-v3-turbo-q5_0.bin', size: 574041195, sha256: '394221709cd5ad1f40c46e6031ca61bce88931e6e088c188294c6d5a55ffa7e2', url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/5359861c739e955e79d9a303bcbc70fb988958b1/ggml-large-v3-turbo-q5_0.bin' },
];
// A short take needs no 30 s window: 50 audio frames are a second, with room to spare. Below half the window models start to repeat themselves. 0 means the whole window.
export function audioCtx(ms) {
  const frames = Math.max(768, Math.ceil(ms / 20) + 256);
  return frames >= 1500 ? 0 : frames;
}
// Physical cores, at most 8: more threads than that gain nothing and fight the app in front
export const whisperThreads = (logical) => Math.max(2, Math.min(8, Math.floor(logical / 2)));
// the prompt tells whisper the names it would otherwise mishear; greedy instead of beam search, a voice key has to feel instant
export const whisperArgs = (model, wav, names = [], { ms = 30000, threads = 4 } = {}) => ['-m', model, '-f', wav, '-l', 'de', '-nt', '-np', '-t', String(threads), '-bs', '1', '-bo', '1', '-ac', String(audioCtx(ms)), '--prompt', ['Hey Nikki', 'Claude', 'Webhook', ...names].join(', ')];
export const VOICE_KEY = 'Control+Alt+V';
export const OLD_MODEL = 'ggml-base.bin'; // 1.3 started with it; it keeps working until the better one is loaded, then it goes

const MODIFIERS = { Control: 0x11, Alt: 0x12, Shift: 0x10, Super: 0x5b };
// the helper polls GetAsyncKeyState, which knows the mouse buttons too; left and right are left out, every click would talk
const MOUSE = { MouseMiddle: 4, MouseBack: 5, MouseForward: 6 };
const NAMED = { Backspace: 8, Tab: 9, Enter: 13, Space: 32, PageUp: 33, PageDown: 34, End: 35, Home: 36, Left: 37, Up: 38, Right: 39, Down: 40, Insert: 45, Delete: 46 };

// 'Control+Alt+V' -> the Windows virtual keys the helper watches; null for anything it cannot watch
export function pttKeys(accelerator) {
  const parts = String(accelerator ?? '').split('+');
  const keys = parts.map((k) => {
    if (MODIFIERS[k]) return MODIFIERS[k];
    if (NAMED[k]) return NAMED[k];
    if (MOUSE[k]) return MOUSE[k];
    if (/^[A-Z0-9]$/.test(k)) return k.charCodeAt(0);
    const f = /^F(\d{1,2})$/.exec(k);
    if (f && f[1] >= 1 && f[1] <= 24) return 111 + Number(f[1]);
    const num = /^num(\d)$/.exec(k);
    return num ? 96 + Number(num[1]) : null;
  });
  return keys.length && keys.every(Boolean) ? keys : null;
}

// whisper's text lines -> one sentence; its notes like [BLANK_AUDIO] or (Musik) are no speech
export function cleanTranscript(out) {
  return String(out ?? '').replace(/\[[^\]]*\]|\([^)]*\)|\*[^*]*\*/g, ' ').replace(/\s+/g, ' ').trim();
}

// Commands start with "Hey Nikki", however whisper spells her, and the call itself is never part of the text. Without it: plain text for the composer.
const CALL = /^(?:hey|hei|hai|he|hi|hallo)[\s,.!:-]+n[iy]c?k+[a-z]{0,3}\b[\s,.!:;-]*/i;
const CLAUDE = '(?:claude|claud|cloud|clord|klord|klaud|klaude|clode|clod|klod|kloud)';
const TELL = new RegExp(`^(?:mal\\s+)?(?:fr[aä]g(?:e)?|sag(?:e)?|schreib(?:e)?|teil(?:e)?)\\s+(?:mal\\s+)?(?:an\\s+)?${CLAUDE}\\b(?:\\s+mal)?(?:\\s+mit)?[\\s,.:;!?-]*(.*)$`, 'i');
const RUN = /^(?:mal\s+)?(?:f[üu]hr(?:e)?|start(?:e)?|l[öo]s(?:e)?|ruf(?:e)?)\s+(?:mal\s+)?(?:den\s+|das\s+)?web\s?-?hook\s+(.*)$/i;
const SEND = /^(?:mal\s+)?(?:schreib(?:e)?|schick(?:e)?|sende?|sag(?:e)?)\s+(?:mal\s+)?(?:(?:an|in|bei|nach|zu)\s+)?(?:den\s+|die\s+|das\s+|dem\s+|der\s+)?(?:web\s?-?hook\s+)?(.*)$/i;

// the name at the start of rest, longest first, as a whole word
function hookIn(rest, names) {
  for (const name of [...names].sort((a, b) => b.length - a.length)) {
    if (!rest.toLowerCase().startsWith(name.toLowerCase())) continue;
    const after = rest.slice(name.length);
    if (!after || /^[\s,.:;!?-]/.test(after)) return { name, after };
  }
  return null;
}
const hookMessage = (after) =>
  after
    .replace(/^[\s,.:;!?-]*(?:aus\b)?[\s,.:;!?-]*(?:(?:mit|und sag|und schreib)\s+(?:dem text\s+)?)?(?:dass\s+)?/i, '')
    .replace(/\s+aus[.!]?$/i, '')
    .trim();

// { kind: 'claude', text } the chosen project | { kind: 'general', text } the general chat, for anything else after the call | { kind: 'webhook', name, text }
// | { kind: 'text', text } the composer | { kind: 'unclear', text } a question back. names: the webhooks the user set up; a misheard name sends nothing out.
export function parseVoice(raw, names = []) {
  const text = String(raw ?? '').trim();
  if (!CALL.test(text)) return { kind: 'text', text };
  const said = text.replace(CALL, '');
  if (!said) return { kind: 'unclear', text: 'Ja? Sag mir, was ich tun soll.' };
  const tell = TELL.exec(said);
  if (tell) return tell[1].trim() ? { kind: 'claude', text: tell[1].trim() } : { kind: 'unclear', text: 'Was soll ich Claude sagen?' };
  const hook = RUN.exec(said) ?? SEND.exec(said);
  const found = hook && hookIn(hook[1], names);
  if (found) {
    const message = hookMessage(found.after);
    return message ? { kind: 'webhook', name: found.name, text: message } : { kind: 'unclear', text: `Was soll an ${found.name}?` };
  }
  return { kind: 'general', text: said };
}

// Only Discord's own webhook addresses: a stored URL decides where spoken words go
export function webhookOk(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && ['discord.com', 'discordapp.com', 'ptb.discord.com', 'canary.discord.com'].includes(u.hostname) && /^\/api\/webhooks\/\d+\/[\w-]+\/?$/.test(u.pathname);
  } catch {
    return false;
  }
}
