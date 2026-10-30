// Spracheingabe (notes/plan/sprache.plan.md): what is downloaded, which key is held, and what a transcript means. main does the rest.

// whisper.cpp and its base model, pinned: nothing else is ever downloaded or run
export const VOICE_ASSETS = [
  { file: 'whisper.zip', size: 8194445, sha256: '49dcc16de826f20bd53d44f947a1ae49dfa81f86cad67a64d80820cb192d674a', url: 'https://github.com/ggml-org/whisper.cpp/releases/download/v1.9.2/whisper-bin-x64.zip' },
  { file: 'ggml-base.bin', size: 147951465, sha256: '60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe', url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/5359861c739e955e79d9a303bcbc70fb988958b1/ggml-base.bin' },
];
export const whisperArgs = (model, wav) => ['-m', model, '-f', wav, '-l', 'de', '-nt', '-np'];
export const VOICE_KEY = 'Control+Alt+V';

const MODIFIERS = { Control: 0x11, Alt: 0x12, Shift: 0x10, Super: 0x5b };
const NAMED = { Backspace: 8, Tab: 9, Enter: 13, Space: 32, PageUp: 33, PageDown: 34, End: 35, Home: 36, Left: 37, Up: 38, Right: 39, Down: 40, Insert: 45, Delete: 46 };

// 'Control+Alt+V' -> the Windows virtual keys the helper watches; null for anything it cannot watch
export function pttKeys(accelerator) {
  const parts = String(accelerator ?? '').split('+');
  const keys = parts.map((k) => {
    if (MODIFIERS[k]) return MODIFIERS[k];
    if (NAMED[k]) return NAMED[k];
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

const CALL = /^(?:(?:hey|hi|hallo)\s+)?(?:nikki[,.!:]?\s+)?/i;
const ASK = /^fr[aä]g(?:e)?\s+(?:claude|cloud|clode|clod|klaude|klod)\b[\s,.:;!?-]*(.*)$/i;
const SEND = /^(?:schreib(?:e)?|schick(?:e)?|sende?|sag(?:e)?)\s+(?:(?:an|in|bei|nach|zu)\s+)?(.*)$/i;

// { kind: 'claude', text } | { kind: 'webhook', name, text } | { kind: 'text', text }. names: the webhooks the user set up; an unknown one is plain text.
export function parseVoice(raw, names = []) {
  const text = String(raw ?? '').trim();
  const said = text.replace(CALL, '');
  const ask = ASK.exec(said);
  if (ask) return ask[1].trim() ? { kind: 'claude', text: ask[1].trim() } : { kind: 'text', text };
  const send = SEND.exec(said);
  if (send) {
    const rest = send[1].replace(/^(?:den|die|das|dem|der)\s+/i, '');
    for (const name of [...names].sort((a, b) => b.length - a.length)) {
      if (!rest.toLowerCase().startsWith(name.toLowerCase())) continue;
      const after = rest.slice(name.length);
      if (after && !/^[\s,.:;!?-]/.test(after)) continue;
      const message = after.replace(/^[\s,.:;!?-]+/, '').replace(/^dass\s+/i, '').trim();
      if (message) return { kind: 'webhook', name, text: message };
    }
  }
  return { kind: 'text', text };
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
