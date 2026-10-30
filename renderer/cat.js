// Nikki the cat (canvas Blob/Sprung): a white blob with cat ears and whiskers, 19 moods, and a stage that moves her through the island.
// Classic script (globals) like glance.js. Pure part first (tables, markup, CSS: cat.css is generated from here, see scripts/build-cat-css.mjs),
// the DOM part (createCatStage) at the end. The CSP allows no inline styles: everything is classes and attributes.

const CAT_MOODS = ['idle', 'look', 'work', 'think', 'listen', 'done', 'purr', 'music', 'need', 'surprised', 'error', 'sad', 'sleep', 'yawn', 'dizzy', 'wave', 'box', 'love', 'blink'];

// eyes, mouth, body animation, eye animation per mood; extras are the small signs around her
const CAT_LOOK = {
  idle: { eye: 'pill', mouth: 'cat', body: 'bob 3.4s ease-in-out infinite', blink: 'blink 4.6s infinite', label: 'Nikki ist wach' },
  blink: { eye: 'pill', mouth: 'cat', body: 'bob 3.4s ease-in-out infinite', blink: 'blink 1.6s infinite', label: 'Nikki blinzelt' },
  look: { eye: 'pill', mouth: 'cat', body: 'bob 3.4s ease-in-out infinite', blink: 'blink 4.6s infinite', eyes: 'lookA 3.2s ease-in-out infinite', label: 'Nikki schaut' },
  work: { eye: 'pill', mouth: 'cat', body: 'nod 1.2s ease-in-out infinite', eyes: 'scan 1.1s ease-in-out infinite', label: 'Nikki arbeitet' },
  think: { eye: 'pill', mouth: 'cat', body: 'sway 3s ease-in-out infinite', eyes: 'thinkEyes 2.4s ease-in-out infinite', extra: 'think', label: 'Nikki denkt nach' },
  listen: { eye: 'tall', mouth: 'cat', body: 'nod 1.6s ease-in-out infinite', perk: true, extra: 'arcs', label: 'Nikki hört zu' },
  need: { eye: 'round', mouth: 'o', body: 'ping 1.6s ease-in-out infinite', perk: true, extra: 'bang', label: 'Nikki braucht dich' },
  surprised: { eye: 'big', mouth: 'open', body: 'pop 2.2s ease-out infinite', perk: true, extra: 'bang', label: 'Nikki ist überrascht' },
  done: { eye: 'happy', mouth: 'smile', body: 'hop 1.8s cubic-bezier(.23,1,.32,1) infinite', extra: 'spark', blush: '.55', label: 'Nikki ist fertig' },
  purr: { eye: 'happy', mouth: 'smile', body: 'vib .12s linear infinite', extra: 'spark', blush: '.55', label: 'Nikki schnurrt' },
  music: { eye: 'happy', mouth: 'smile', body: 'dance .9s ease-in-out infinite', extra: 'notes', whisk: true, label: 'Nikki tanzt' },
  wave: { eye: 'happy', mouth: 'smile', body: 'bob 3s ease-in-out infinite', blink: 'blink 4.6s infinite', extra: 'wave', label: 'Nikki winkt' },
  error: { eye: 'squint', mouth: 'frown', body: 'shake .7s ease-in-out infinite', extra: 'err sweat', blush: '.55', label: 'Nikki hat einen Fehler' },
  sad: { eye: 'sad', mouth: 'frown', body: 'sway 4.5s ease-in-out infinite', droop: true, extra: 'tear', blush: '.2', label: 'Nikki ist traurig' },
  dizzy: { eye: 'spiral', mouth: 'o', body: 'wobble 1.1s ease-in-out infinite', extra: 'sweat', label: 'Nikki ist schwindelig' },
  yawn: { eye: 'closed', mouth: 'yawn', body: 'breathe 3.2s ease-in-out infinite', label: 'Nikki gähnt' },
  sleep: { eye: 'closed', mouth: 'cat', body: 'breathe 3.6s ease-in-out infinite', droop: true, extra: 'zz', label: 'Nikki schläft' },
  box: { eye: 'pill', mouth: 'cat', body: 'bob 3.4s ease-in-out infinite', blink: 'blink 4.6s infinite', extra: 'box', label: 'Nikki sitzt in der Kiste' },
  love: { eye: 'heart', mouth: 'smile', body: 'heartBeat 1.4s ease-in-out infinite', extra: 'spark', blush: '.55', label: 'Nikki ist verliebt' },
};

// the idle life: what she does while nothing happens (name, ms)
const CAT_IDLE = [['idle', 3500], ['look', 2600], ['idle', 3000], ['blink', 1500], ['think', 3200], ['idle', 2800], ['look', 2600], ['purr', 2600], ['idle', 3200], ['yawn', 3000], ['sleep', 9000], ['surprised', 1300]];

// what the closed notch's glance says → her mood; done and error only last a moment
function catMoodFor(glow) {
  return { need: 'need', work: 'work', done: 'done', error: 'error', music: 'music', voice: 'listen' }[glow] ?? 'idle';
}
const CAT_TIMED = { done: 3600, error: 4200 };

const CAT_EYES = ['pill', 'tall', 'round', 'big', 'happy', 'closed', 'sad', 'squint', 'heart', 'spiral'];
const CAT_MOUTHS = ['cat', 'smile', 'open', 'frown', 'yawn', 'o'];
const CAT_EXTRAS = ['sweat', 'tear', 'zz', 'notes', 'bang', 'err', 'think', 'arcs', 'spark', 'wave', 'box'];

// shared <defs> (gradients, clip, eye shapes); once per document, referenced by every cat
function catDefs() {
  return `<svg class="catDefs" width="0" height="0" aria-hidden="true" focusable="false"><defs>
<linearGradient id="nbBody" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#ebe8e3"/></linearGradient>
<linearGradient id="nbWL" gradientUnits="userSpaceOnUse" x1="20" y1="0" x2="-8" y2="0"><stop offset="0" stop-color="#f4f4f2" stop-opacity="0.85"/><stop offset="1" stop-color="#f4f4f2" stop-opacity="0.15"/></linearGradient>
<linearGradient id="nbWR" gradientUnits="userSpaceOnUse" x1="100" y1="0" x2="128" y2="0"><stop offset="0" stop-color="#f4f4f2" stop-opacity="0.85"/><stop offset="1" stop-color="#f4f4f2" stop-opacity="0.15"/></linearGradient>
<clipPath id="nbClip"><path d="M18 62 C18 34 38 22 60 22 C82 22 102 34 102 62 C102 88 84 100 60 100 C36 100 18 88 18 62 Z"/></clipPath>
<g id="nbPill"><rect x="-4" y="-7" width="8" height="14" rx="4" fill="#2b2622"/><circle cx="1" cy="-3" r="1.4" fill="#fff"/></g>
<g id="nbTall"><rect x="-4.5" y="-10" width="9" height="20" rx="4.5" fill="#2b2622"/><circle cx="1" cy="-5" r="1.6" fill="#fff"/></g>
<g id="nbRound"><circle r="6.5" fill="#2b2622"/><circle cx="2" cy="-2.5" r="2" fill="#fff"/></g>
<g id="nbBig"><circle r="8.5" fill="#2b2622"/><circle cx="2.4" cy="-3" r="2.7" fill="#fff"/><circle cx="-2.6" cy="3" r="1.2" fill="#fff" opacity=".8"/></g>
<g id="nbHappy"><path d="M-7 3 Q0 -7 7 3" fill="none" stroke="#2b2622" stroke-width="2.6" stroke-linecap="round"/></g>
<g id="nbClosed"><path d="M-7 -1 Q0 6 7 -1" fill="none" stroke="#2b2622" stroke-width="2.4" stroke-linecap="round"/></g>
<g id="nbSad"><rect x="-4" y="-6" width="8" height="12" rx="4" fill="#2b2622" transform="rotate(8)"/><circle cx="1" cy="-2" r="1.3" fill="#fff"/><path d="M-8 -11 L5 -7" stroke="#2b2622" stroke-width="1.8" stroke-linecap="round"/></g>
<g id="nbSquint"><path d="M-6 -6 L5 0 L-6 6" fill="none" stroke="#2b2622" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></g>
<g id="nbHeart"><path d="M0 5 C-9 -1 -6 -9 0 -4 C6 -9 9 -1 0 5Z" fill="#ff7f98"/></g>
<g id="nbSpiral"><path d="M0 0 m-5 0 a5 5 0 1 1 10 0 a3.5 3.5 0 1 1 -7 0 a2 2 0 1 1 4 0" fill="none" stroke="#2b2622" stroke-width="1.7" stroke-linecap="round"/></g>
</defs></svg>`;
}

// one cat; the look is chosen by data-mood on the svg (cat.css)
function catSvg() {
  const pair = (id, flip) => `<use href="#${id}" transform="translate(44 58)"/><use href="#${id}" transform="translate(76 58)${flip ? ' scale(-1 1)' : ''}"/>`;
  const eyes = [
    ['pill', `<g class="fb c-blink">${pair('nbPill')}</g>`], ['tall', pair('nbTall')], ['round', pair('nbRound')], ['big', pair('nbBig')], ['happy', pair('nbHappy')],
    ['closed', pair('nbClosed')], ['sad', pair('nbSad', true)], ['squint', pair('nbSquint', true)],
    ['heart', `<g class="fb c-beat"><use href="#nbHeart" transform="translate(44 58)"/></g><g class="fb c-beat"><use href="#nbHeart" transform="translate(76 58)"/></g>`],
    ['spiral', `<g class="fb c-spin"><use href="#nbSpiral" transform="translate(44 58)"/></g><g class="fb c-spinR"><use href="#nbSpiral" transform="translate(76 58)"/></g>`],
  ].map(([k, m]) => `<g class="ce ce-${k}">${m}</g>`).join('');
  const whisk = (side, d, g) => `<g class="fb c-wh${side}"><g class="c-wd" fill="none" stroke="url(#${g})" stroke-width="1.1" stroke-linecap="round">${d.map((p) => `<path d="${p}"/>`).join('')}</g></g>`;
  const mouths = {
    cat: '<path d="M54.5 72 Q57.3 75 60 72 Q62.7 75 65.5 72" fill="none" stroke="#7b6f67" stroke-width="1.5" stroke-linecap="round"/>',
    smile: '<path d="M53 71.5 Q60 79 67 71.5" fill="none" stroke="#7b6f67" stroke-width="1.8" stroke-linecap="round"/>',
    open: '<ellipse cx="60" cy="75" rx="3.4" ry="4.2" fill="#8c4a52"/><ellipse cx="60" cy="77" rx="2" ry="1.6" fill="#f09aa6"/>',
    frown: '<path d="M54.5 76 Q60 71 65.5 76" fill="none" stroke="#7b6f67" stroke-width="1.8" stroke-linecap="round"/>',
    yawn: '<g class="fbt c-yawn"><ellipse cx="60" cy="77" rx="6" ry="7.5" fill="#8c4a52"/><ellipse cx="60" cy="80.5" rx="3.6" ry="2.6" fill="#f09aa6"/></g>',
    o: '<ellipse cx="60" cy="73.5" rx="2.2" ry="2.6" fill="#8c4a52"/>',
  };
  const font = 'font-family="Segoe UI, system-ui, sans-serif"';
  const extras = {
    sweat: '<g class="fb c-drop"><path d="M90 40 Q94 47 90 50 Q86 47 90 40 Z" fill="#9fd4ff"/></g>',
    tear: '<g class="fb c-tear"><path d="M38 66 Q41 72 38 75 Q35 72 38 66 Z" fill="#9fd4ff"/></g>',
    zz: `<text class="fb c-z1" x="96" y="26" font-size="12" font-weight="700" fill="#a3a3ad" ${font}>z</text><text class="fb c-z2" x="96" y="26" font-size="9" font-weight="700" fill="#a3a3ad" ${font}>z</text>`,
    notes: `<text class="fb c-n1" x="100" y="40" font-size="15" fill="#c9d9ff" font-family="Segoe UI Symbol, Segoe UI, sans-serif">♪</text><text class="fb c-n2" x="8" y="44" font-size="13" fill="#c9d9ff" font-family="Segoe UI Symbol, Segoe UI, sans-serif">♫</text>`,
    bang: '<g class="fb c-ping"><rect x="88" y="-2" width="14" height="16" rx="5" fill="#ffc861"/><rect x="94.2" y="2" width="2.6" height="6" rx="1.3" fill="#3a2a05"/><circle cx="95.5" cy="11" r="1.5" fill="#3a2a05"/></g>',
    err: '<g class="fb c-ping"><rect x="88" y="-2" width="14" height="16" rx="5" fill="#ff8a8a"/><path d="M92.5 3 L98.5 9 M98.5 3 L92.5 9" stroke="#3a0a0a" stroke-width="1.8" stroke-linecap="round"/></g>',
    think: '<circle class="c-d1" cx="92" cy="14" r="2" fill="#a3a3ad"/><circle class="c-d2" cx="100" cy="8" r="2.6" fill="#a3a3ad"/><circle class="c-d3" cx="110" cy="3" r="3.2" fill="#a3a3ad"/>',
    arcs: '<g fill="none" stroke="#7ff0c8" stroke-width="1.8" stroke-linecap="round"><path class="fb c-a1" d="M110 50 Q116 58 110 66"/><path class="fb c-a2" d="M116 44 Q126 58 116 72"/><path class="fb c-a3" d="M10 50 Q4 58 10 66"/><path class="fb c-a4" d="M4 44 Q-6 58 4 72"/></g>',
    spark: '<g fill="#ffe9a8"><path class="fb c-s1" d="M14 24 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z"/><path class="fb c-s2" d="M104 30 l1.6 4 4 1.6 -4 1.6 -1.6 4 -1.6 -4 -4 -1.6 4 -1.6z"/><path class="fb c-s3" d="M110 78 l1.2 3 3 1.2 -3 1.2 -1.2 3 -1.2 -3 -3 -1.2 3 -1.2z"/></g>',
    wave: '<g class="c-arm"><path d="M98 82 Q112 78 114 62" fill="none" stroke="#ffffff" stroke-width="10" stroke-linecap="round"/><circle cx="114" cy="60" r="6.5" fill="#ffffff"/><circle cx="112.5" cy="59" r="1.1" fill="#f3a1aa"/><circle cx="116" cy="59" r="1.1" fill="#f3a1aa"/><circle cx="114.2" cy="62.6" r="1.4" fill="#f3a1aa"/></g>',
    box: '<g class="fb c-peek"><path d="M10 84 L110 84 L106 110 Q106 114 102 114 L18 114 Q14 114 14 110 Z" fill="#b98a5a"/><path d="M10 84 L110 84 L108 90 L12 90 Z" fill="#cfa06c"/><rect x="46" y="96" width="28" height="6" rx="3" fill="#8f673c" opacity=".7"/></g>',
  };
  // signs that sit on the body are drawn inside it, the rest (z, notes, arcs, spark, wave) around it
  const onBody = ['sweat', 'tear'];
  const x = (list) => list.map((k) => `<g class="cx cx-${k}">${extras[k]}</g>`).join('');
  return `<svg class="cat" data-mood="idle" viewBox="-8 -4 136 120" role="img" aria-label="Nikki ist wach">
<g class="fbb c-body">
<g class="fb c-earL"><path d="M24 44 L26 10 L52 30 Z" fill="#ffffff"/><path d="M30 38 L31 19 L45 30 Z" fill="#f3b3ba"/></g>
<g class="fb c-earR"><path d="M96 44 L94 10 L68 30 Z" fill="#ffffff"/><path d="M90 38 L89 19 L75 30 Z" fill="#f3b3ba"/></g>
<path d="M18 62 C18 34 38 22 60 22 C82 22 102 34 102 62 C102 88 84 100 60 100 C36 100 18 88 18 62 Z" fill="url(#nbBody)"/>
<g clip-path="url(#nbClip)" opacity="0.5" stroke="#8f857c" stroke-width="2.2" stroke-linecap="round" fill="none"><path d="M54 24 L55 33"/><path d="M60 22 L60 35"/><path d="M66 24 L65 33"/><path d="M30 38 L38 41"/><path d="M90 38 L82 41"/></g>
<ellipse class="c-blush" cx="30" cy="70" rx="6" ry="3.6" fill="#f3a1aa"/><ellipse class="c-blush" cx="90" cy="70" rx="6" ry="3.6" fill="#f3a1aa"/>
${whisk('L', ['M20 66 Q8 63 -6 58', 'M20 70 Q8 70 -6 71', 'M20 74 Q8 77 -6 84'], 'nbWL')}${whisk('R', ['M100 66 Q112 63 126 58', 'M100 70 Q112 70 126 71', 'M100 74 Q112 77 126 84'], 'nbWR')}
<g class="fb c-eyes">${eyes}</g>
<path d="M58 66.5 L62 66.5 L60 69 Z" fill="#f09aa6" stroke="#f09aa6" stroke-width="1" stroke-linejoin="round"/>
${CAT_MOUTHS.map((k) => `<g class="cm cm-${k}">${mouths[k]}</g>`).join('')}
${x(onBody)}
</g>
${x(['zz', 'notes', 'bang', 'err', 'think', 'arcs', 'spark', 'wave', 'box'])}
</svg>`;
}

// cat.css: every look selected by data-mood. Keyframes carry the ct- prefix, they share the document with style.css.
function catCss() {
  const a = (anim) => 'ct-' + anim; // 'bob 3.4s …' → 'ct-bob 3.4s …'
  const moods = Object.keys(CAT_LOOK);
  const pick = (test) => moods.filter((m) => test(CAT_LOOK[m]));
  const sel = (list, tail) => list.map((m) => `.cat[data-mood='${m}'] ${tail}`).join(',\n');
  const rule = (list, tail, body) => (list.length ? `${sel(list, tail)} { ${body} }\n` : '');
  let css = `/* generated from renderer/cat.js by scripts/build-cat-css.mjs, do not edit by hand */
.cat { display: block; width: 100%; height: 100%; overflow: visible; }
.cat .fb { transform-box: fill-box; transform-origin: center; }
.cat .fbb { transform-box: fill-box; transform-origin: 50% 100%; }
.cat .fbt { transform-box: fill-box; transform-origin: 50% 0; }
.cat .c-earL { transform-origin: 40px 30px; }
.cat .c-earR { transform-origin: 80px 30px; }
.cat .c-whL { transform-origin: 20px 70px; }
.cat .c-whR { transform-origin: 100px 70px; }
.cat .c-arm { transform-box: fill-box; transform-origin: 98px 82px; animation: ct-waveArm 0.7s ease-in-out infinite; }
.cat .ce, .cat .cm, .cat .cx { display: none; }
.cat .c-blush { opacity: 0.28; }
`;
  for (const k of CAT_EYES) css += rule(pick((l) => l.eye === k), `.ce-${k}`, 'display: inline;');
  for (const k of CAT_MOUTHS) css += rule(pick((l) => l.mouth === k), `.cm-${k}`, 'display: inline;');
  for (const k of CAT_EXTRAS) css += rule(pick((l) => (l.extra ?? '').split(' ').includes(k)), `.cx-${k}`, 'display: inline;');
  for (const m of moods) css += `.cat[data-mood='${m}'] .c-body { animation: ${a(CAT_LOOK[m].body)}; }\n`;
  const perk = pick((l) => l.perk);
  const calm = pick((l) => !l.perk && !l.droop);
  css += rule(perk, '.c-earL', 'animation: ct-earPerk 0.8s ease-in-out infinite;');
  css += rule(perk, '.c-earR', 'animation: ct-earPerkR 0.8s ease-in-out infinite;');
  css += rule(calm, '.c-earL', 'animation: ct-earTwitchL 6s ease-in-out infinite;');
  css += rule(calm, '.c-earR', 'animation: ct-earTwitchR 7.5s ease-in-out infinite;');
  const wag = pick((l) => l.perk || l.whisk);
  css += rule(wag, '.c-whL', 'animation: ct-wiggleL 0.45s ease-in-out infinite;');
  css += rule(wag, '.c-whR', 'animation: ct-wiggleR 0.45s ease-in-out infinite;');
  css += rule(pick((l) => l.droop), '.c-wd', 'transform: translateY(3px);');
  for (const m of pick((l) => l.eyes)) css += `.cat[data-mood='${m}'] .c-eyes { animation: ${a(CAT_LOOK[m].eyes)}; }\n`;
  for (const m of pick((l) => l.blink)) css += `.cat[data-mood='${m}'] .c-blink { animation: ${a(CAT_LOOK[m].blink)}; }\n`;
  for (const b of ['.55', '.2']) css += rule(pick((l) => l.blush === b), '.c-blush', `opacity: ${b};`);
  css += `.cat .c-beat { animation: ct-heartBeat 0.9s ease-in-out infinite; }
.cat .c-spin { animation: ct-spin 1.1s linear infinite; }
.cat .c-spinR { animation: ct-spin 1.1s linear infinite reverse; }
.cat .c-yawn { animation: ct-yawn 3.2s ease-in-out infinite; }
.cat .c-drop { animation: ct-drop 1.6s ease-in infinite; }
.cat .c-tear { animation: ct-tearF 2.6s ease-in infinite; }
.cat .c-z1 { animation: ct-zzf 2.8s ease-out infinite; }
.cat .c-z2 { animation: ct-zzf 2.8s ease-out 1.4s infinite; }
.cat .c-n1 { animation: ct-noteF 2.2s ease-out infinite; }
.cat .c-n2 { animation: ct-noteF 2.2s ease-out 1.1s infinite; }
.cat .c-ping { animation: ct-ping 1.6s ease-in-out infinite; }
.cat .c-d1 { animation: ct-dots 1.4s infinite; }
.cat .c-d2 { animation: ct-dots 1.4s 0.25s infinite; }
.cat .c-d3 { animation: ct-dots 1.4s 0.5s infinite; }
.cat .c-a1 { animation: ct-arcs 1.5s ease-out infinite; }
.cat .c-a2 { animation: ct-arcs 1.5s ease-out 0.5s infinite; }
.cat .c-a3 { animation: ct-arcs 1.5s ease-out 0.25s infinite; }
.cat .c-a4 { animation: ct-arcs 1.5s ease-out 0.75s infinite; }
.cat .c-s1 { animation: ct-sparkle 1.8s ease-in-out infinite; }
.cat .c-s2 { animation: ct-sparkle 1.8s ease-in-out 0.6s infinite; }
.cat .c-s3 { animation: ct-sparkle 1.8s ease-in-out 1.1s infinite; }
.cat .c-peek { animation: ct-peek 2.4s ease-in-out infinite; }
`;
  const frames = {
    bob: '0%,100%{transform:translateY(0) scale(1,1)}50%{transform:translateY(-2.5px) scale(1.012,.99)}',
    hop: '0%,55%,100%{transform:translateY(0) scale(1,1)}62%{transform:translateY(1px) scale(1.06,.93)}74%{transform:translateY(-11px) scale(.96,1.05)}86%{transform:translateY(0) scale(1.05,.95)}',
    shake: '0%,100%{transform:translateX(0)}15%{transform:translateX(-3px)}30%{transform:translateX(3px)}45%{transform:translateX(-2px)}60%{transform:translateX(2px)}75%{transform:translateX(0)}',
    dance: '0%,100%{transform:translateY(0) rotate(-4deg)}25%{transform:translateY(-6px) rotate(0)}50%{transform:translateY(0) rotate(4deg)}75%{transform:translateY(-6px) rotate(0)}',
    vib: '0%,100%{transform:translateX(-.5px)}50%{transform:translateX(.5px)}',
    sway: '0%,100%{transform:rotate(-1.5deg) translateY(1px)}50%{transform:rotate(1.5deg) translateY(1px)}',
    breathe: '0%,100%{transform:scale(1,1)}50%{transform:scale(1.025,1.045)}',
    nod: '0%,100%{transform:translateY(0)}50%{transform:translateY(2px)}',
    wobble: '0%,100%{transform:rotate(-6deg)}50%{transform:rotate(6deg)}',
    pop: '0%,70%,100%{transform:scale(1,1)}78%{transform:scale(1.1,.92)}88%{transform:scale(.95,1.08)}',
    blink: '0%,91%,100%{transform:scaleY(1)}94%{transform:scaleY(.1)}',
    lookA: '0%,12%,100%{transform:translateX(0)}28%,48%{transform:translateX(3.5px)}64%,84%{transform:translateX(-3.5px)}',
    scan: '0%,100%{transform:translateX(-3px)}50%{transform:translateX(3px)}',
    thinkEyes: '0%,100%{transform:translate(2px,-3px)}50%{transform:translate(3px,-3.5px)}',
    earTwitchL: '0%,86%,100%{transform:rotate(0)}90%{transform:rotate(-9deg)}94%{transform:rotate(3deg)}',
    earTwitchR: '0%,70%,100%{transform:rotate(0)}74%{transform:rotate(9deg)}78%{transform:rotate(-3deg)}',
    earPerk: '0%,100%{transform:rotate(0)}50%{transform:rotate(-7deg)}',
    earPerkR: '0%,100%{transform:rotate(0)}50%{transform:rotate(7deg)}',
    wiggleL: '0%,100%{transform:rotate(3deg)}50%{transform:rotate(-5deg)}',
    wiggleR: '0%,100%{transform:rotate(-3deg)}50%{transform:rotate(5deg)}',
    zzf: '0%{opacity:0;transform:translate(0,0)}25%{opacity:.95}100%{opacity:0;transform:translate(7px,-12px)}',
    noteF: '0%{opacity:0;transform:translate(0,6px)}20%{opacity:1}100%{opacity:0;transform:translate(6px,-22px)}',
    sparkle: '0%,100%{opacity:0;transform:scale(.3)}40%{opacity:1;transform:scale(1)}70%{opacity:.4;transform:scale(.7)}',
    ping: '0%,60%,100%{transform:scale(1)}70%{transform:scale(1.18)}80%{transform:scale(.96)}',
    drop: '0%,30%{opacity:0;transform:translateY(-3px)}50%{opacity:1}100%{opacity:0;transform:translateY(10px)}',
    arcs: '0%{opacity:0;transform:scale(.7)}30%{opacity:.9}100%{opacity:0;transform:scale(1.25)}',
    dots: '0%,100%{opacity:.25}33%{opacity:1}',
    waveArm: '0%,100%{transform:rotate(-10deg)}50%{transform:rotate(26deg)}',
    spin: 'to{transform:rotate(360deg)}',
    yawn: '0%,100%{transform:scale(.3,.2);opacity:.3}40%,70%{transform:scale(1,1);opacity:1}',
    peek: '0%,100%{transform:translateY(2px)}50%{transform:translateY(-2px)}',
    tearF: '0%,25%{opacity:0;transform:translateY(0)}45%{opacity:1}100%{opacity:0;transform:translateY(12px)}',
    heartBeat: '0%,100%{transform:scale(1)}30%{transform:scale(1.18)}60%{transform:scale(.96)}',
  };
  for (const [name, body] of Object.entries(frames)) css += `@keyframes ct-${name} { ${body} }\n`;
  css += '@media (prefers-reduced-motion: reduce) { .cat * { animation: none !important; } }\n';
  return css;
}

// ---------- the DOM part: where she sits in each view and how she gets from one to the next ----------

const CAT_W = 93; // px, the svg's viewBox 136x120 at .68
const CAT_H = 82;
const CAT_PEEK = 54; // how much of her shows above an edge

// position of el inside box by layout (transforms of a page animation do not count)
function catOffset(el, box) {
  let x = 0;
  let y = 0;
  for (let n = el; n && n !== box; n = n.offsetParent) {
    x += n.offsetLeft;
    y += n.offsetTop;
  }
  return { x, y, w: el.offsetWidth, h: el.offsetHeight };
}

// Her place per view: 'sit' (Home: bottom right in the Claude tile) or 'peek' (over the top edge of something in the page).
// Every other page has its own spot where there is air (candidates are tried in order, the first anchor that exists wins):
//   sit  at: top-right | bottom-right | left (beside the anchor, bottom aligned)    peek  x: share of the anchor's width
// Everything is a pure function of the layout, so the stage can ask again after every resize.
const CAT_PLACES = {
  music: [{ sel: '.musicPage, .musicEmpty', type: 'sit', at: 'top-right' }],
  calendar: [{ sel: null, type: 'sit', at: 'bottom-right' }],
  shelf: [{ sel: '.shelfGrid, .shelfEmpty', type: 'peek', x: 0.55 }],
  todo: [{ sel: '.todoList', type: 'peek', x: 0.62 }],
  notes: [{ sel: '.padBar', type: 'peek', x: 0.5 }, { sel: '.padEmpty', type: 'sit', at: 'bottom-right' }],
  timer: [{ sel: '.timerRing', type: 'sit', at: 'left' }],
};
function catSpot(view, { box, home, composer, pageOf }) {
  if (view === 'home' && home) {
    const r = catOffset(home, box);
    return { type: 'sit', left: r.x + r.w - CAT_W - 4, top: r.y + r.h - CAT_H };
  }
  if (view === 'chat' && composer) {
    const r = catOffset(composer, box);
    // left of centre: the permission card's buttons sit at the right edge and must stay clickable
    return { type: 'peek', left: Math.round(r.x + r.w * 0.42 - CAT_W / 2), edge: r.y };
  }
  const page = pageOf?.(view);
  for (const c of CAT_PLACES[view] ?? []) {
    const el = c.sel ? page?.querySelector?.(c.sel) : page;
    if (!el || !el.offsetParent) continue;
    const r = catOffset(el, box);
    if (c.type === 'peek') return { type: 'peek', left: Math.round(r.x + r.w * c.x - CAT_W / 2), edge: r.y };
    if (c.at === 'top-right') return { type: 'sit', left: r.x + r.w - CAT_W - 10, top: r.y + 8 };
    if (c.at === 'left') return { type: 'sit', left: Math.max(16, r.x - CAT_W - 14), top: r.y + r.h - CAT_H };
    return { type: 'sit', left: r.x + r.w - CAT_W - 4, top: r.y + r.h - CAT_H };
  }
  const first = page?.firstElementChild;
  const r = first ? catOffset(first, box) : { y: 62 };
  return { type: 'peek', left: Math.round(box.offsetWidth * 0.62), edge: Math.max(r.y, 62) };
}

// the tab icon's shrunk-cat landing: centred on the button
function catIconBox(btn, box) {
  const r = catOffset(btn, box);
  return { left: Math.round(r.x + r.w / 2 - CAT_W / 2), top: Math.round(r.y + r.h / 2 - CAT_H + 11.5) };
}

const CAT_EASE = 'cubic-bezier(0.45, 0, 0.55, 1)';
const CAT_EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';

function createCatStage({ box, tabs, ctx, reduceMotion = false, canJump = () => true }) {
  const mk = (cls) => {
    const el = document.createElement('div');
    el.className = cls;
    el.innerHTML = `<div class="catIn">${catSvg()}</div>`;
    box.append(el);
    return el;
  };
  const rest = mk('catRest');
  const fly = mk('catFly');
  fly.hidden = true;
  const svgOf = (el) => el.querySelector('.cat');
  let view = 'home';
  let base = 'idle';
  let timed = null; // { mood, t } done / error for a moment
  let touchMood = null;
  let idleMood = 'idle';
  let idleI = 0;
  let active = false;
  let busy = false;
  let timers = [];
  const later = (fn, ms) => timers.push(setTimeout(fn, ms));

  const mood = () => touchMood || timed?.mood || (base !== 'idle' ? base : idleMood);
  function paint() {
    if (busy) return; // a jump sets her looks itself
    for (const el of [rest, fly]) {
      const svg = svgOf(el);
      const m = mood();
      if (svg.dataset.mood !== m) {
        svg.dataset.mood = m;
        svg.setAttribute('aria-label', CAT_LOOK[m].label);
      }
    }
  }
  function idleStep() {
    const [m, ms] = CAT_IDLE[idleI++ % CAT_IDLE.length];
    idleMood = m;
    paint();
    idleTimer = setTimeout(idleStep, ms);
  }
  let idleTimer = null;
  let hoverTimer = null;
  let touchTimer = null;
  let clicks = [];

  function touch(m, ms) {
    clearTimeout(touchTimer);
    touchMood = m;
    paint();
    if (ms) touchTimer = setTimeout(() => ((touchMood = null), paint()), ms);
  }

  function sync() {
    const s = catSpot(view, ctx());
    rest.dataset.type = s.type;
    rest.style.left = `${s.left}px`;
    if (s.type === 'sit') {
      rest.style.top = `${s.top}px`;
      rest.style.height = `${CAT_H}px`;
    } else {
      rest.style.top = `${s.edge - CAT_PEEK}px`;
      rest.style.height = `${CAT_PEEK}px`;
    }
    return s;
  }
  const inner = (el) => el.querySelector('.catIn');
  function stop() {
    timers.forEach(clearTimeout);
    timers = [];
    switchTo.token++;
    for (const el of [rest, fly, inner(rest), inner(fly)]) el.getAnimations().forEach((x) => x.cancel());
    fly.hidden = true;
    rest.style.visibility = '';
    busy = false;
  }

  const wait = (a) => a.finished.catch(() => {});
  // out of a sit spot: crouch, arc up into the icon of the target tab, the icon swallows her
  async function leave(spot, tab) {
    if (spot.type === 'peek') {
      await wait(inner(rest).animate([{ transform: 'translateY(0)', easing: CAT_EASE_OUT, offset: 0 }, { transform: 'translateY(-8%)', easing: CAT_EASE, offset: 0.22 }, { transform: 'translateY(100%)' }], { duration: 260, fill: 'forwards' }));
      return;
    }
    const to = catIconBox(tab, box);
    flyAlong(spot, to, 480, true);
    rest.style.visibility = 'hidden';
    later(() => tab.animate([{ scale: 1 }, { scale: 1.28, offset: 0.4 }, { scale: 1 }], { duration: 280, easing: CAT_EASE_OUT }), 380);
    await new Promise((r) => later(r, 500));
    fly.hidden = true;
  }
  // arrive: the icon spits her out and she arcs to her place, or she pops up behind the edge
  async function arrive(spot, tab) {
    if (spot.type === 'peek') {
      rest.style.visibility = '';
      await wait(inner(rest).animate([{ transform: 'translateY(100%)' }, { transform: 'translateY(0)' }], { duration: 440, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)', fill: 'forwards' }));
      return;
    }
    const from = catIconBox(tab, box);
    rest.style.visibility = 'hidden';
    tab.animate([{ scale: 1 }, { scale: 1.28, offset: 0.4 }, { scale: 1 }], { duration: 260, easing: CAT_EASE_OUT });
    flyAlong(from, { left: spot.left, top: spot.top }, 520, false);
    await new Promise((r) => later(r, 540));
    fly.hidden = true;
    rest.style.visibility = '';
  }
  // outer: straight line with a flat ease; inner: the hop (squash, rise, shrink into the icon / grow out of it)
  function flyAlong(from, to, ms, shrink) {
    const dx = to.left - from.left;
    const dy = to.top - from.top;
    const arc = Math.max(16, Math.min(shrink ? 66 : 36, Math.round(0.47 * Math.max(from.top, to.top) - 36)));
    for (const el of [fly, inner(fly)]) el.getAnimations().forEach((x) => x.cancel());
    fly.hidden = false;
    fly.style.left = `${from.left}px`;
    fly.style.top = `${from.top}px`;
    fly.animate([{ transform: 'translate(0, 0)' }, { transform: `translate(${dx}px, ${dy}px)` }], { duration: ms, easing: CAT_EASE, fill: 'forwards' });
    const hop = shrink
      ? [{ transform: 'translateY(0) scale(1, 1)', opacity: 1, offset: 0 }, { transform: 'translateY(4px) scale(1.1, 0.84)', offset: 0.14 }, { transform: `translateY(${-arc}px) scale(0.84, 0.9)`, offset: 0.52 }, { opacity: 1, offset: 0.86 }, { transform: 'translateY(0) scale(0.28, 0.28)', opacity: 0, offset: 1 }]
      : [{ transform: 'translateY(0) scale(0.28, 0.28)', opacity: 0, offset: 0 }, { opacity: 1, offset: 0.14 }, { transform: `translateY(${-arc}px) scale(0.86, 0.92)`, offset: 0.5 }, { transform: 'translateY(0) scale(1.08, 0.88)', offset: 0.84 }, { transform: 'translateY(0) scale(1, 1)', opacity: 1, offset: 1 }];
    inner(fly).style.transformOrigin = '50% 100%';
    inner(fly).animate(hop, { duration: ms, easing: CAT_EASE, fill: 'forwards' });
  }

  // Moves from the current view to `to`: she leaves first, commit() switches the page, then she arrives in the new one.
  async function switchTo(to, commit) {
    const quick = Date.now() - (switchTo.last ?? 0) < 900;
    switchTo.last = Date.now();
    if (busy) {
      stop();
      commit();
      view = to;
      sync();
      return;
    }
    if (reduceMotion || quick || !canJump() || to === view || !tabs.querySelector(`.tab[data-view="${to}"]`)) {
      commit();
      view = to;
      sync();
      return;
    }
    busy = true;
    const from = sync();
    const tabOf = (v) => tabs.querySelector(`.tab[data-view="${v}"]`);
    touchMood = null;
    const token = ++switchTo.token;
    const goingOut = from.type === 'peek' ? 'surprised' : 'done';
    for (const el of [rest, fly]) svgOf(el).dataset.mood = goingOut;
    await leave(from, tabOf(to));
    if (token !== switchTo.token || !busy) return;
    commit();
    view = to;
    const spot = sync();
    inner(rest).getAnimations().forEach((x) => x.cancel());
    for (const el of [rest, fly]) svgOf(el).dataset.mood = 'wave';
    await arrive(spot, tabOf(to));
    if (token !== switchTo.token) return;
    inner(rest).getAnimations().forEach((x) => x.cancel());
    busy = false;
    paint();
  }
  switchTo.token = 0;

  // her body takes the mouse: love after two quiet seconds, three quick clicks make her dizzy
  const body = inner(rest);
  body.addEventListener('mouseenter', () => {
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(() => touch('love', 0), 2000);
  });
  body.addEventListener('mouseleave', () => {
    clearTimeout(hoverTimer);
    if (touchMood === 'love') touch(null, 0);
  });
  body.addEventListener('click', () => {
    const now = Date.now();
    clicks = clicks.filter((t) => now - t < 2200).concat(now);
    const n = clicks.length;
    touch(n >= 3 ? 'dizzy' : n === 2 ? 'error' : 'surprised', n >= 3 ? 2600 : 1300);
    if (n >= 3) clicks = [];
  });

  sync();
  paint();
  return {
    sync,
    switchTo,
    touch,
    setView(v) {
      if (!busy) view = v;
      sync();
    },
    // the closed notch's glance: need / work / done / error / music / voice / null
    setGlow(glow, sleeping = false) {
      const b = sleeping ? 'sleep' : catMoodFor(glow);
      if (b === base) return;
      base = b;
      clearTimeout(timed?.t);
      timed = CAT_TIMED[b] ? { mood: b, t: setTimeout(() => ((timed = null), paint()), CAT_TIMED[b]) } : null;
      paint();
    },
    // alive only while the island is open: no timers for a cat nobody sees
    setActive(on) {
      if (on === active) return;
      active = on;
      clearTimeout(idleTimer);
      if (on) idleStep();
      else stop();
      sync();
    },
    isBusy: () => busy,
    mood,
  };
}
