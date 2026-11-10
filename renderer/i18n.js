// Language of the interface. German is the source; the English dictionary (i18n/en.json) is keyed by the German text.
// No call site translates anything: in English a MutationObserver swaps every text node and the attributes below as they
// appear, so code and tests keep working with the German strings. Elements marked translate="no" (user content) stay as they are.
// Classic script, loaded first in every window. The pure part (i18nTranslator) also runs in main and in the tests (vm).

const I18N_ATTRS = ['title', 'aria-label', 'placeholder', 'alt', 'data-tip']; // data-tip: a tooltip CSS shows with attr()
// what people wrote or got (chat, notifications, lyrics, file and to-do names) stays as it is, even when it equals a UI word
const I18N_KEEP = '[translate="no"], .msg, .toastTitle, .toastBody, .musicLyric, .shelfName, .todoText span, .calChipTitle';

// dict { German: English }; a key with {0}, {1}… is a pattern: the parts it captures are translated themselves
function i18nTranslator(dict) {
  const exact = new Map();
  const patterns = [];
  for (const [de, en] of Object.entries(dict)) {
    if (!/\{\d\}/.test(de)) {
      exact.set(de, en);
      continue;
    }
    const slots = [];
    const src = de
      .split(/(\{\d\})/)
      .map((part) => (/^\{\d\}$/.test(part) ? (slots.push(part), '(.+?)') : part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
      .join('');
    const fixed = de.replace(/\{\d\}/g, '').trim().length;
    if (fixed) patterns.push({ re: new RegExp(`^${src}$`, 's'), slots, en, fixed });
  }
  patterns.sort((a, b) => b.fixed - a.fixed); // the most specific pattern first
  return function t(text, depth = 0) {
    const s = String(text ?? '');
    const key = s.trim();
    if (!key || depth > 4) return s;
    let out = exact.get(key);
    if (out === undefined)
      for (const p of patterns) {
        const m = p.re.exec(key);
        if (!m) continue;
        out = p.slots.reduce((acc, slot, i) => acc.replaceAll(slot, t(m[i + 1], depth + 1)), p.en);
        break;
      }
    return out === undefined ? s : s.replace(key, () => out); // the spaces around stay
  };
}

// translates what is in the document and everything that comes later
function i18nStart(t) {
  const off = (el) => !!el?.closest?.(I18N_KEEP);
  const text = (n) => {
    if (off(n.parentElement)) return;
    const v = t(n.data);
    if (v !== n.data) n.data = v;
  };
  const attrs = (el) => {
    if (off(el)) return;
    for (const a of I18N_ATTRS) {
      const v = el.getAttribute(a);
      if (!v) continue;
      const w = t(v);
      if (w !== v) el.setAttribute(a, w);
    }
  };
  const walk = (node) => {
    if (node.nodeType === Node.TEXT_NODE) return text(node);
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    attrs(node);
    const w = document.createTreeWalker(node, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) n.nodeType === Node.TEXT_NODE ? text(n) : attrs(n);
  };
  new MutationObserver((list) => {
    for (const m of list) {
      if (m.type === 'characterData') text(m.target);
      else if (m.type === 'attributes') attrs(m.target);
      else m.addedNodes.forEach(walk);
    }
  }).observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: I18N_ATTRS });
  walk(document.documentElement); // what the parser built before this script ran
}

// lang from main (setting "Sprache", or Windows' language); in the test sandbox there is no companion and it stays German
const NIKKI_LANG = globalThis.companion?.lang === 'en' ? 'en' : 'de';
const LOCALE = NIKKI_LANG === 'en' ? 'en-GB' : 'de-DE'; // for every toLocale…String
if (NIKKI_LANG === 'en' && typeof document !== 'undefined') {
  document.documentElement.lang = 'en';
  i18nStart(i18nTranslator(globalThis.companion.dict));
}
