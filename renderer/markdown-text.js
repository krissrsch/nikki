// Pure text tidy-ups before Markdown render. Classic script (globals) until the renderer moves to ES modules.

// Claude often emits broken bold like `**1. **` — tidy before Markdown render.
function normalizeMarkdown(text) {
  return String(text ?? '')
    .replace(/\*\*([^*\n]*?)\s+\*\*/g, (_, inner) => `**${inner.trimEnd()}**`)
    .replace(/\*\*\s+([^*\n]*?)\*\*/g, (_, inner) => `**${inner.trimStart()}**`)
    .replace(/(^|\n)(\*\*\d+\.\*\*)\s*\n(?!\n)/g, '$1$2\n\n');
}

/** Glued sentences ("fertig.Jetzt") get a space; paragraph lines break before the next sentence (not Dr., z.B.). */
function softBreakSentences(text) {
  return String(text ?? '')
    .split('\n')
    .map((line) => {
      const spaced = line.replace(/(?<=[a-zäöüß]{2})([.!?])(?=[A-ZÄÖÜ][a-zäöüß])/g, '$1 ');
      // lists, headings, quotes and tables keep their shape
      if (/^\s*([-*+]\s|\d+[.)]\s|#|>|\|)/.test(spaced)) return spaced;
      return spaced.replace(/(?<=[a-zäöüß]{2})([.!?])[ \t]+(?=[A-ZÄÖÜ])/g, '$1\n\n');
    })
    .join('\n');
}

// Code (fenced, indented, inline) and URLs reach marked byte-for-byte; fn only ever sees prose.
const MD_FENCE = /^ {0,3}(`{3,}(?!.*`)|~{3,})/;
const MD_KEEP = /``[^\n]*?``|`[^`\n]*`|(?:https?:\/\/|www\.)[^\s<>()]*[^\s<>().,;:!?'"*_]|^(?: {4}|\t).*$/gm;
function onlyProse(text, fn) {
  const out = [];
  let prose = [];
  let fence = null;
  const flush = () => {
    if (!prose.length) return;
    const kept = [];
    const masked = prose.join('\n').replace(MD_KEEP, (m) => `${kept.push(m) - 1}`);
    out.push(fn(masked).replace(/(\d+)/g, (_, i) => kept[i]));
    prose = [];
  };
  for (const line of String(text ?? '').split('\n')) {
    const f = line.match(MD_FENCE);
    if (fence) {
      out.push(line);
      if (f && f[1][0] === fence[0] && f[1].length >= fence.length) fence = null;
    } else if (f) {
      flush();
      fence = f[1];
      out.push(line);
    } else prose.push(line);
  }
  flush();
  return out.join('\n');
}

const prepareMd = (text) => onlyProse(text, (s) => normalizeMarkdown(softBreakSentences(s)));
