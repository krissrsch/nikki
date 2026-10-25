// Maps Cursor ACP session/update notifications to companion status: { state, text, answer? }.
import { describeTool } from './status.js';

const short = (s, n = 40) => {
  const t = String(s ?? '');
  return t.length > n ? t.slice(0, n - 1) + '…' : t;
};

function toolTitle(u) {
  const title = u.title || u.toolCall?.title || u.kind || u.toolName || 'Tool';
  const name = String(title).replace(/^mcp[_:]?/i, '');
  // Prefer describeTool when the title looks like a known Claude-style tool name
  if (/^(Read|Edit|Write|Bash|Shell|Grep|Glob|WebFetch|WebSearch|Task|Agent)$/i.test(name)) {
    return describeTool(name, u.rawInput ?? u.input ?? {});
  }
  if (/shell|bash|powershell|terminal/i.test(name)) {
    const cmd = u.rawInput?.command ?? u.input?.command ?? '';
    return cmd ? `Nikki: ${short(String(cmd).split('\n')[0], 16)}…` : 'Nikki im Terminal…';
  }
  if (/read|edit|write|file/i.test(name)) {
    const p = u.rawInput?.path ?? u.rawInput?.file_path ?? u.input?.path ?? '';
    return p ? `Nikki tippt ${short(String(p).split(/[\\/]/).pop(), 18)}…` : 'Nikki tippt…';
  }
  return 'Nikki arbeitet…';
}

/** Map one ACP `session/update` params.update object to status, or null. */
export function acpUpdateToStatus(update, prev = {}) {
  if (!update || typeof update !== 'object') return null;
  const kind = update.sessionUpdate || update.type;

  if (kind === 'agent_thought_chunk') {
    return { state: 'thinking', text: 'Nikki denkt…' };
  }
  if (kind === 'agent_message_chunk') {
    const text = update.content?.text ?? update.text ?? '';
    if (!text) return { state: 'thinking', text: 'Nikki denkt…' };
    const answer = (prev.answer ?? '') + text;
    return { state: 'thinking', text: 'Nikki denkt…', answer, _partial: true };
  }

  if (kind === 'tool_call' || kind === 'tool_call_update') {
    const status = update.status || update.toolCall?.status;
    if (status === 'pending' || status === 'in_progress' || !status) {
      return { state: 'working', text: toolTitle(update) };
    }
    if (status === 'completed' || status === 'failed') {
      return { state: 'working', text: toolTitle(update) };
    }
  }

  if (kind === 'available_commands_update' || kind === 'current_mode_update') return null;
  return null;
}

/**
 * Cursor ACP sometimes streams internal transport failures as assistant text
 * (`Error: RetriableError: WritableIterable is closed`) and still returns end_turn.
 * Strip the junk; flag pure transport failures so the client can retry.
 */
export function scrubCursorAnswer(answer) {
  const raw = String(answer ?? '');
  // Prefer keeping real prose; only strip a trailing Cursor transport dump.
  const clean = raw
    .replace(/\n\nError:\s*(?:RetriableError|ConnectError)[\s\S]*$/i, '')
    .replace(/\n+Error:\s*(?:RetriableError|ConnectError)[\s\S]*$/i, '')
    .replace(/\n\nSomething went wrong communicating with the server\.[\s\S]*$/i, '')
    .trimEnd();
  const trimmed = raw.trim();
  const onlyDump =
    !clean.trim() &&
    (/^(?:Error:\s*)?(?:RetriableError|ConnectError)\b/i.test(trimmed) ||
      /WritableIterable is closed/i.test(trimmed) ||
      /^Something went wrong communicating with the server/i.test(trimmed));
  return { answer: onlyDump ? '' : clean, transportFail: onlyDump };
}

/**
 * Cursor ACP never offers the AskQuestion tool, so agents write choices as prose.
 * Detect Coucou-style picks: "Frage? (A / B)" or "Tee oder Kaffee?" or trailing bullet options.
 */
export function extractTextChoice(answer) {
  const raw = String(answer ?? '').trim();
  if (!raw || raw.length > 4000) return null;

  const make = (question, opts) => {
    const options = [...new Set(opts.map((o) => String(o).trim()).filter((o) => o.length >= 1 && o.length <= 48))];
    if (options.length < 2 || options.length > 6) return null;
    const q = String(question).trim().replace(/\s+/g, ' ');
    if (q.length < 3 || q.length > 160) return null;
    return {
      title: 'Auswahl',
      summary: `Nikki: ${short(q.replace(/\?$/, ''), 28)}? (${options.slice(0, 3).join(' / ')}${options.length > 3 ? ' …' : ''})`,
      questions: [
        {
          id: 'q1',
          question: /\?$/.test(q) ? q : `${q}?`,
          options: options.map((label, i) => ({ id: `o${i}`, label })),
          multiSelect: false,
        },
      ],
    };
  };

  // "…? (Ja / Nein)" — Coucou notch style
  const paren = raw.match(/([^\n]{3,120}\?)\s*\(([^)\n]{3,80})\)\s*$/);
  if (paren) {
    const opts = paren[2].split(/\s*\/\s*|\s*\|\s*|\s*;\s*/).map((s) => s.trim()).filter(Boolean);
    const hit = make(paren[1], opts);
    if (hit) return hit;
  }

  // trailing "- Tee" / "1. Kaffee" / "• Ja" lines after a question
  const lines = raw.split(/\n/).map((l) => l.trim()).filter(Boolean);
  const qIdx = [...lines].map((l, i) => (/\?\s*$/.test(l) ? i : -1)).filter((i) => i >= 0).pop();
  if (qIdx != null && qIdx < lines.length - 1) {
    const tail = lines.slice(qIdx + 1);
    const bullets = tail
      .map((l) => l.replace(/^(?:[-*•]|\d+[.)])\s+/, '').replace(/\*\*/g, '').trim())
      .filter((l) => l && !/\?$/.test(l) && l.length <= 40);
    if (bullets.length >= 2 && bullets.length === tail.length) {
      const hit = make(lines[qIdx], bullets);
      if (hit) return hit;
    }
  }

  // "… Tee oder Kaffee?" / "Ja oder Nein?" — take the two short options at the end
  const oder = raw.match(
    /\b([A-ZÄÖÜa-zäöüß][\wÄÖÜäöüß-]{0,30})\s+oder\s+([A-ZÄÖÜa-zäöüß][\wÄÖÜäöüß-]{0,30})\s*\?\s*$/i,
  );
  if (oder) {
    const a = oder[1].trim();
    const b = oder[2].trim();
    const hit = make(`${a} oder ${b}?`, [a, b]);
    if (hit) return hit;
  }

  return null;
}

/** Build the final status when session/prompt returns. */
export function acpPromptResultToStatus(result, answer = '') {
  const { answer: scrubbed, transportFail } = scrubCursorAnswer(answer);
  if (transportFail) {
    return {
      state: 'error',
      text: 'Nikki verlor die Leitung.',
      answer:
        'Cursor hat die Verbindung kurz verloren (bekanntes ACP-Problem). Nochmal senden reicht meist.',
    };
  }
  const stop = result?.stopReason;
  if (stop === 'cancelled' || stop === 'canceled') return { state: 'idle', text: 'Nikki stoppte.', answer: scrubbed };
  if (stop === 'end_turn' || stop === 'stop' || !stop) return { state: 'done', text: 'Nikki ist fertig.', answer: scrubbed };
  if (stop === 'max_tokens' || stop === 'error') return { state: 'error', text: 'Nikki stolpert.', answer: scrubbed || String(stop) };
  return { state: 'done', text: 'Nikki ist fertig.', answer: scrubbed };
}

/** Normalize permission tool label from ACP request_permission params. */
export function acpPermissionReq(params = {}) {
  const toolCall = params.toolCall ?? params;
  const toolName = toolCall?.title || toolCall?.kind || toolCall?.toolName || 'Tool';
  const input = toolCall?.rawInput ?? toolCall?.input ?? params.input ?? {};
  return { toolName: String(toolName), input, title: params.title };
}
