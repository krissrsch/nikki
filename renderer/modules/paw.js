// Paw (lib/paw.js): ask a question, Pawprint searches the user's past Claude Code chats and Claude answers from what it found.
// State: { phase: idle | starting | asking, draft, result: { ok: true, answer, sources: [{ project, date, title, text }] } | { ok: false, error, text } | null }

// ---- pure, tested in modules.test.js
// the answer as parts: plain text, **bold**, `code` and [Quelle n]; nothing else becomes markup
function pawParts(answer) {
  return String(answer ?? '')
    .split(/(\[Quelle \d+\]|\*\*[^*\n]+\*\*|`[^`\n]+`)/)
    .filter(Boolean)
    .map((p) => {
      const src = p.match(/^\[Quelle (\d+)\]$/);
      if (src) return { kind: 'source', n: Number(src[1]), text: p };
      if (/^\*\*[^*\n]+\*\*$/.test(p)) return { kind: 'bold', text: p.slice(2, -2) };
      if (/^`[^`\n]+`$/.test(p)) return { kind: 'code', text: p.slice(1, -1) };
      return { kind: 'text', text: p };
    });
}
const PAW_PHASE = {
  starting: 'Pawprint startet … Beim ersten Mal dauert das etwas länger.',
  asking: 'Pawprint sucht in deinen Chats, Claude liest die Fundstellen … Das dauert 10 bis 20 Sekunden.',
};
// "2026-10-25 · Projekt · Titel" for a source's heading
const pawSourceLine = (s) => [s.date, s.project, s.title].filter(Boolean).join(' · ');

(() => {
  const api = globalThis.companion; // undefined in the unit test sandbox
  const ICON =
    '<svg class="ti" viewBox="0 0 24 24" aria-hidden="true"><circle cx="5.5" cy="11" r="1.8" /><circle cx="9.5" cy="6.5" r="1.8" /><circle cx="14.5" cy="6.5" r="1.8" /><circle cx="18.5" cy="11" r="1.8" /><path d="M12 12c-3 0-5.5 3-5.5 5.3 0 1.6 1.4 2.4 2.8 2.4 1 0 1.8-.6 2.7-.6s1.7.6 2.7.6c1.4 0 2.8-.8 2.8-2.4C17.5 15 15 12 12 12z" /></svg>';
  let ctx = null;
  let root = null;
  let phase = 'idle';
  let draft = '';
  let result = null;
  let sourceBox = null;

  const part = (p) => {
    if (p.kind === 'bold') return h('strong', {}, p.text);
    if (p.kind === 'code') return h('code', {}, p.text);
    if (p.kind !== 'source') return p.text;
    return h('button', { type: 'button', className: 'pawRef', title: 'Fundstelle zeigen', onclick: () => openSource(p.n) }, p.text);
  };

  function openSource(n) {
    const d = sourceBox?.querySelector(`[data-n="${n}"]`);
    if (!d) return;
    d.open = true;
    d.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  async function chooseExe() {
    if ((await api?.pawChoose())?.ok) ask(draft);
  }

  async function ask(question) {
    const q = question.trim();
    if (!q || phase !== 'idle') return;
    draft = question;
    result = null;
    phase = 'starting';
    render();
    result = (await api?.pawAsk(q)) ?? { ok: false, error: 'http', text: 'Pawprint hat nicht geantwortet.' };
    phase = 'idle';
    render();
    ctx?.changed();
  }

  function render() {
    if (!root || !ctx?.shown()) return;
    const busy = phase !== 'idle';
    const input = h('input', { type: 'text', className: 'pawInput', placeholder: 'Frag deine Geschichte …', ariaLabel: 'Frage an Pawprint', maxLength: 500, value: draft, disabled: busy });
    input.addEventListener('input', () => (draft = input.value));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') ask(input.value);
    });
    const go = h('button', { type: 'button', className: 'btn', disabled: busy, onclick: () => ask(input.value) }, 'Fragen');
    const kids = [h('div', { className: 'pawForm' }, input, go)];
    if (busy) kids.push(h('p', { className: 'pawStatus', role: 'status' }, PAW_PHASE[phase]));
    else if (!result) kids.push(h('p', { className: 'pawStatus' }, 'Pawprint sucht die Antwort in deinen früheren Claude-Chats, über alle Projekte.'));
    else if (!result.ok) {
      kids.push(h('p', { className: 'pawStatus bad', role: 'status' }, result.text));
      if (result.error === 'noexe') {
        kids.push(h('p', { className: 'pawStatus' }, 'Pawprint ist ein eigenes Programm (github.com/krissrsch/pawprint). Ist es installiert, wähl die Datei pawprint.exe aus.'));
        kids.push(h('button', { type: 'button', className: 'btn', onclick: chooseExe }, 'pawprint.exe wählen …'));
      }
    } else {
      const answer = h('p', { className: 'pawAnswer', translate: 'no' }, ...pawParts(result.answer).map(part));
      sourceBox = h(
        'div',
        { className: 'pawSources', translate: 'no' },
        ...result.sources.map((s, i) =>
          h('details', { className: 'pawSrc' }, h('summary', {}, `[${i + 1}] ${pawSourceLine(s)}`), h('pre', {}, s.text)),
        ),
      );
      sourceBox.querySelectorAll('details').forEach((d, i) => (d.dataset.n = i + 1));
      // the island clips what is taller than it: answer and sources scroll in their own box, the question stays on top
      kids.push(h('div', { className: 'pawResult' }, answer, sourceBox));
    }
    root.replaceChildren(h('div', { className: 'pawBox' }, ...kids));
    if (!busy) input.focus();
  }

  api?.onPaw((p) => {
    if (p === 'asking' && phase !== 'idle') phase = 'asking';
    render();
  });

  registerModule({
    id: 'paw',
    title: 'Paw',
    icon: ICON,
    start(c) {
      ctx = c;
    },
    stop() {
      ctx = root = sourceBox = null;
    },
    page(el) {
      root = el;
      render();
    },
  });
})();
