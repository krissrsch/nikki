// The voice capsule, after the way Coucou stages it: her head and nine dots that follow the voice; a small wave while the words are worked out; a short message at the end.
// main sends { phase: listening | thinking | message | hidden, text?, tone? } and the microphone's 12 bands.
const api = window.companion;
const $ = (id) => document.getElementById(id);
const DOTS = 9;
const DOT_MAX = 24;
const MOOD = { listening: 'listen', thinking: 'think', message: 'done' };

document.body.insertAdjacentHTML('beforeend', catDefs());
$('pillCat').innerHTML = catHeadSvg();
const head = $('pillCat').querySelector('.cat');
const dots = Array.from({ length: DOTS }, () => $('pillDots').appendChild(document.createElement('i')));
let phase = 'hidden';
let target = Array(DOTS).fill(0);
let shown = Array(DOTS).fill(0);
let lastBands = 0;
let raf = 0;

function frame(t) {
  raf = phase === 'listening' || phase === 'thinking' ? requestAnimationFrame(frame) : 0;
  const quiet = t - lastBands > 220; // the helper only sends while something sounds
  shown = shown.map((v, i) => {
    const goal = phase === 'thinking' ? 0.1 + 0.22 * Math.max(0, Math.sin(t / 133 - i * 0.75)) : quiet ? 0 : target[i];
    return v + (goal - v) * (goal > v ? 0.5 : 0.18);
  });
  dots.forEach((d, i) => (d.style.height = `${4 + (DOT_MAX - 4) * shown[i]}px`));
}

api.onPill(({ phase: next, text = '', tone = '' }) => {
  phase = next;
  $('pill').hidden = next === 'hidden';
  $('pill').dataset.tone = tone;
  $('pillDots').hidden = next === 'message';
  $('pillText').hidden = next !== 'message';
  $('pillText').textContent = text;
  head.dataset.mood = tone === 'bad' ? 'sad' : (MOOD[next] ?? 'idle');
  if (!raf && (next === 'listening' || next === 'thinking')) raf = requestAnimationFrame(frame);
});
api.onPillBands((bands) => {
  lastBands = performance.now();
  target = Array.from({ length: DOTS }, (_, i) => bands[Math.round((i * (bands.length - 1)) / (DOTS - 1))] ?? 0);
});
