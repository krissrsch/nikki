// Errors from the Claude CLI / Agent SDK in Nikki's words. The island shows the sentence; the original text stays
// available under "Details" (main sends it along as `detail`), so nothing the CLI said gets lost.
// First match wins: specific causes before the generic "process exited", which often wraps them.
const KNOWN = [
  [/no conversation found/i, 'Diese Unterhaltung kennt Claude nicht mehr. Fang mit + eine neue Session an.'],
  [/usage limit|rate.?limit|limit reached|hit your limit|too many requests|\b429\b/i, 'Dein Claude-Limit ist gerade aufgebraucht. Später geht es weiter.'],
  [/not logged in|\/login|invalid api key|authenticat|oauth token|unauthori[sz]ed|\b401\b/i, 'Claude ist nicht angemeldet. Tipp einmal „claude“ im Terminal und melde dich an.'],
  [/overloaded|\b529\b/i, 'Claude ist gerade überlastet. Versuch es gleich noch mal.'],
  [/econnrefused|econnreset|enotfound|etimedout|eai_again|getaddrinfo|fetch failed|connection error|socket hang up|network/i, 'Nikki kommt nicht zu Claude durch. Ist das Internet da?'],
  [/prompt is too long|context (window|length)/i, 'Die Unterhaltung ist zu lang geworden. Fang mit + eine neue Session an.'],
  [/error_max_turns|max(imum)? turns/i, 'Claude hat zu viele Schritte gebraucht und aufgehört.'],
  [/executable not found|enoent/i, 'Nikki findet Claude Code nicht. Ist es installiert?'],
  [/spawn \w+/i, 'Nikki kann Claude Code nicht starten. Ist es richtig installiert?'], // EFTYPE, EACCES, UNKNOWN: there but not runnable
  [/agent beendet ohne ergebnis/i, 'Claude hat ohne Ergebnis aufgehört. Versuch es noch mal.'],
  [/process exited|process terminated|exited with code/i, 'Claude Code hat sich unterwegs verabschiedet. Versuch es noch mal.'],
];

export function friendlyError(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return 'Nikki ist gestolpert.';
  return KNOWN.find(([re]) => re.test(text))?.[1] ?? 'Da ging etwas schief, das Nikki nicht kennt. Was Claude meldet, steht unter Details.';
}
