// Nikki the cat, drawn after the real one: white with a grey-brown tabby cap and white blaze, amber eyes, tabby saddle, ringed tail. Body in profile,
// face to the viewer, 19 moods, a stage that moves her through the island, and the head that peeks out from behind the closed notch.
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
  surprised: { pose: 'stand', eye: 'big', mouth: 'open', body: 'pop 2.2s ease-out infinite', perk: true, extra: 'bang', label: 'Nikki ist überrascht' },
  done: { pose: 'stand', eye: 'happy', mouth: 'smile', body: 'hop 1.8s cubic-bezier(.23,1,.32,1) infinite', extra: 'spark', blush: '.55', label: 'Nikki ist fertig' },
  purr: { eye: 'happy', mouth: 'smile', body: 'vib .12s linear infinite', extra: 'spark', blush: '.55', label: 'Nikki schnurrt' },
  music: { pose: 'stand', eye: 'happy', mouth: 'smile', body: 'dance .9s ease-in-out infinite', extra: 'notes', whisk: true, label: 'Nikki tanzt' },
  wave: { eye: 'happy', mouth: 'smile', body: 'bob 3s ease-in-out infinite', blink: 'blink 4.6s infinite', extra: 'wave', label: 'Nikki winkt' },
  error: { pose: 'stand', eye: 'squint', mouth: 'frown', body: 'shake .7s ease-in-out infinite', extra: 'err sweat', blush: '.55', label: 'Nikki hat einen Fehler' },
  sad: { eye: 'sad', mouth: 'frown', body: 'sway 4.5s ease-in-out infinite', droop: true, extra: 'tear', blush: '.2', label: 'Nikki ist traurig' },
  dizzy: { eye: 'spiral', mouth: 'o', body: 'wobble 1.1s ease-in-out infinite', extra: 'sweat', label: 'Nikki ist schwindelig' },
  yawn: { eye: 'closed', mouth: 'yawn', body: 'breathe 3.2s ease-in-out infinite', label: 'Nikki gähnt' },
  sleep: { pose: 'loaf', eye: 'closed', mouth: 'cat', body: 'breathe 3.6s ease-in-out infinite', droop: true, extra: 'zz', label: 'Nikki schläft' },
  box: { pose: 'loaf', eye: 'pill', mouth: 'cat', body: 'bob 3.4s ease-in-out infinite', blink: 'blink 4.6s infinite', extra: 'box', label: 'Nikki sitzt in der Kiste' },
  love: { eye: 'heart', mouth: 'smile', body: 'heartBeat 1.4s ease-in-out infinite', extra: 'spark', blush: '.55', label: 'Nikki ist verliebt' },
};

// the idle life: what she does while nothing happens (name, ms)
const CAT_IDLE = [['idle', 3500], ['look', 2600], ['idle', 3000], ['blink', 1500], ['think', 3200], ['idle', 2800], ['look', 2600], ['purr', 2600], ['idle', 3200], ['yawn', 3000], ['sleep', 9000], ['surprised', 1300]];

// what the closed notch's glance says → her mood; done and error only last a moment
function catMoodFor(glow) {
  return { need: 'need', work: 'work', done: 'done', error: 'error', music: 'music', voice: 'listen' }[glow] ?? 'idle';
}
const CAT_TIMED = { done: 3600, error: 4200 };

// body poses from 1.0, in its 64 x 56 units; a mood without pose sits, 'stand' is the drawing as it is
const CAT_POSES = {
  sit: {
    torso: 'rotate(-10deg)',
    head: 'translate(-1.75px, -4.05px)',
    lb1: 'scaleY(0.3)',
    lb2: 'scaleY(0.3)',
    lf1: 'translate(-0.8px, -6.25px) scaleY(1.57)',
    lf2: 'translate(-0.9px, -7.3px) scaleY(1.66)',
    tail: 'translate(-1px, 0) rotate(22deg)',
  },
  loaf: {
    torso: 'translateY(4.5px)',
    head: 'translate(-1px, 5px) rotate(4deg)',
    lb1: 'scaleY(0.12)',
    lb2: 'scaleY(0.12)',
    lf1: 'scaleY(0.12)',
    lf2: 'scaleY(0.12)',
    tail: 'translate(7px, 5px) rotate(108deg)',
  },
};

const CAT_EYES = ['pill', 'tall', 'round', 'big', 'happy', 'closed', 'sad', 'squint', 'heart', 'spiral'];
const CAT_MOUTHS = ['cat', 'smile', 'open', 'frown', 'yawn', 'o'];
const CAT_EXTRAS = ['sweat', 'tear', 'zz', 'notes', 'bang', 'err', 'think', 'arcs', 'spark', 'wave', 'box'];

const CAT_TABBY = '#8b8075';
const CAT_STRIPE = '#6a6056';

// shared <defs> (fur, iris, clips, eye shapes); once per document, referenced by every cat
function catDefs() {
  const eye = (id, rx, ry, px, py, gx, gy, gr) => `<g id="${id}"><ellipse rx="${rx + 0.9}" ry="${ry + 0.9}" fill="#2a2420"/><ellipse rx="${rx}" ry="${ry}" fill="url(#nbIris)"/><ellipse rx="${px}" ry="${py}" fill="#17130f"/><circle cx="${gx}" cy="${gy}" r="${gr}" fill="#fff"/></g>`;
  return `<svg class="catDefs" width="0" height="0" aria-hidden="true" focusable="false"><defs>
<linearGradient id="nbFur" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#ece8e2"/></linearGradient>
<radialGradient id="nbIris"><stop offset="0" stop-color="#f1e390"/><stop offset=".62" stop-color="#d6bd52"/><stop offset="1" stop-color="#9c8430"/></radialGradient>
<clipPath id="nbHeadClip"><path d="${CAT_HEAD}"/></clipPath>
<clipPath id="nbBodyClip"><path d="${CAT_BODY}"/></clipPath>
${eye('nbPill', 7.2, 7.8, 5.4, 6.2, 2.4, -3, 2.6)}
${eye('nbTall', 7.4, 10, 5.4, 8, 2.4, -4.6, 2.7)}
${eye('nbRound', 7.6, 7.6, 4.6, 4.8, 2.6, -2.8, 2.4)}
${eye('nbBig', 9, 9, 6.4, 6.6, 3, -3.4, 3)}
<g id="nbHappy"><path d="M-7 3 Q0 -7 7 3" fill="none" stroke="#1e1a24" stroke-width="3.6" stroke-linecap="round"/></g>
<g id="nbClosed"><path d="M-7 -1 Q0 6 7 -1" fill="none" stroke="#1e1a24" stroke-width="3.6" stroke-linecap="round"/></g>
<g id="nbSad"><use href="#nbPill"/><path d="M-9 -12 L5 -9" stroke="#1e1a24" stroke-width="3" stroke-linecap="round"/></g>
<g id="nbSquint"><path d="M-6 -6 L5 0 L-6 6" fill="none" stroke="#1e1a24" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/></g>
<g id="nbHeart"><path d="M0 5 C-9 -1 -6 -9 0 -4 C6 -9 9 -1 0 5Z" fill="#ff7f98"/></g>
<g id="nbSpiral"><path d="M0 0 m-5 0 a5 5 0 1 1 10 0 a3.5 3.5 0 1 1 -7 0 a2 2 0 1 1 4 0" fill="none" stroke="#1e1a24" stroke-width="2.6" stroke-linecap="round"/></g>
</defs></svg>`;
}

const CAT_HEAD = 'M27 27 C27 17 34 13.5 42 13.5 C50 13.5 57 17 57 27 C57 35.5 50 40.5 42 40.5 C34 40.5 27 35.5 27 27Z';
const CAT_BODY = 'M13.5 40 C13.5 33.5 20 31 27.5 31.3 C35 31.6 40.5 34.5 40.5 41 C40.5 47 34 49.5 27 49.5 C19.5 49.5 13.5 46.5 13.5 40Z';

// the head alone, in the drawing's 64 x 56 units: the whole cat wears it, and it peeks out from behind the notch
function catHead() {
  const mirror = (m) => `<g transform="matrix(-1 0 0 1 84 0)">${m}</g>`;
  const at = (x) => `translate(${x} 26)`;
  const size = 'scale(.52)';
  const pair = (id, flip) => `<use href="#${id}" transform="${at(36.5)} ${size}"/><use href="#${id}" transform="${at(47.5)} ${flip ? 'scale(-.52 .52)' : size}"/>`;
  const eyes = [
    ['pill', `<g class="fb c-blink">${pair('nbPill')}</g>`], ['tall', pair('nbTall')], ['round', pair('nbRound')], ['big', pair('nbBig')], ['happy', pair('nbHappy')],
    ['closed', pair('nbClosed')], ['sad', pair('nbSad', true)], ['squint', pair('nbSquint', true)],
    ['heart', `<g class="fb c-beat"><use href="#nbHeart" transform="${at(36.5)} ${size}"/></g><g class="fb c-beat"><use href="#nbHeart" transform="${at(47.5)} ${size}"/></g>`],
    ['spiral', `<g class="fb c-spin"><use href="#nbSpiral" transform="${at(36.5)} ${size}"/></g><g class="fb c-spinR"><use href="#nbSpiral" transform="${at(47.5)} ${size}"/></g>`],
  ].map(([k, m]) => `<g class="ce ce-${k}">${m}</g>`).join('');
  const whisk = (side, d) => `<g class="fb c-wh${side}"><g class="c-wd" fill="none" stroke="#d8d4ce" stroke-width=".45" stroke-linecap="round">${d.map((p) => `<path d="${p}"/>`).join('')}</g></g>`;
  const mouths = {
    cat: '<path d="M54.5 72 Q57.3 75 60 72 Q62.7 75 65.5 72" fill="none" stroke="#2a2430" stroke-width="1.8" stroke-linecap="round"/>',
    smile: '<path d="M53 71.5 Q60 79 67 71.5" fill="none" stroke="#2a2430" stroke-width="1.8" stroke-linecap="round"/>',
    open: '<ellipse cx="60" cy="75" rx="3.4" ry="4.2" fill="#3a2430"/><ellipse cx="60" cy="77" rx="2" ry="1.6" fill="#f08ca4"/>',
    frown: '<path d="M54.5 76 Q60 71 65.5 76" fill="none" stroke="#2a2430" stroke-width="1.8" stroke-linecap="round"/>',
    yawn: '<g class="fbt c-yawn"><ellipse cx="60" cy="76" rx="5.5" ry="6.5" fill="#3a2430"/><ellipse cx="60" cy="79" rx="3.4" ry="2.4" fill="#f08ca4"/></g>',
    o: '<ellipse cx="60" cy="73.5" rx="2.2" ry="2.6" fill="#3a2430"/>',
  };
  const ear = '<path d="M29 22 C28 14 29.5 7 31 3.6 C31.6 2.4 32.8 2.4 33.7 3.2 C37 6 40 9.5 42 14 Z" fill="#7d7268"/><path d="M31.4 18 C31 12.5 31.8 8.6 32.6 6.4 C35 8.4 37 10.8 38.6 13.6 Z" fill="#e9aab4"/>';
  // the cap leaves the blaze free: narrow on the forehead, the whole muzzle below the eyes
  const cap = `<path d="M24 8 H41.4 C41.6 15 41.2 18.5 40.2 21.5 C41 25 41.2 28 38 31 C35 33.6 30 33.4 26 31 Z" fill="${CAT_TABBY}"/><path d="M38.4 15 L37.8 19.5 M34.4 15.6 L33.2 20" fill="none" stroke="${CAT_STRIPE}" stroke-width="1" stroke-linecap="round"/>`;
  return `<g class="c-head">
<g class="c-earL">${ear}</g><g class="c-earR">${mirror(ear)}</g>
<path d="${CAT_HEAD}" fill="url(#nbFur)"/>
<g clip-path="url(#nbHeadClip)">${cap}${mirror(cap)}</g>
<ellipse class="c-blush" cx="33" cy="34" rx="2.6" ry="1.5" fill="#f4afbe"/><ellipse class="c-blush" cx="51" cy="34" rx="2.6" ry="1.5" fill="#f4afbe"/>
${whisk('L', ['M31 32.5 Q27 31.4 24 30', 'M31 34.4 Q27 34.6 24 35.4'])}${whisk('R', ['M53 32.5 Q57 31.4 60 30', 'M53 34.4 Q57 34.6 60 35.4'])}
<g class="fb c-eyes">${eyes}</g>
<path d="M40.6 31.2 h2.8 q.3 0 .1 .4 l-1.2 1.4 q-.3 .3 -.6 0 l-1.2 -1.4 q-.2 -.4 .1 -.4z" fill="#efa6b4"/>
<g transform="translate(42 33.6) scale(.55) translate(-60 -72)">${CAT_MOUTHS.map((k) => `<g class="cm cm-${k}">${mouths[k]}</g>`).join('')}</g>
</g>`;
}

// just her head, for the closed notch
function catHeadSvg() {
  return `<svg class="cat catHead" data-mood="idle" viewBox="20 0 44 44" role="presentation">${catHead()}</svg>`;
}

// one cat; the look is chosen by data-mood on the svg (cat.css)
function catSvg() {
  const font = 'font-family="Segoe UI, system-ui, sans-serif"';
  const extras = {
    sweat: '<g class="fb c-drop"><path d="M108 34 Q112 41 108 44 Q104 41 108 34 Z" fill="#9fd4ff"/></g>',
    tear: '<g class="fb c-tear"><path d="M66 68 Q69 74 66 77 Q63 74 66 68 Z" fill="#9fd4ff"/></g>',
    zz: `<text class="fb c-z1" x="106" y="20" font-size="12" font-weight="700" fill="#a3a3ad" ${font}>z</text><text class="fb c-z2" x="106" y="20" font-size="9" font-weight="700" fill="#a3a3ad" ${font}>z</text>`,
    notes: `<text class="fb c-n1" x="108" y="34" font-size="15" fill="#c9d9ff" font-family="Segoe UI Symbol, Segoe UI, sans-serif">♪</text><text class="fb c-n2" x="30" y="44" font-size="13" fill="#c9d9ff" font-family="Segoe UI Symbol, Segoe UI, sans-serif">♫</text>`,
    bang: '<g class="fb c-ping"><rect x="104" y="-2" width="14" height="16" rx="5" fill="#ffc861"/><rect x="110.2" y="2" width="2.6" height="6" rx="1.3" fill="#3a2a05"/><circle cx="111.5" cy="11" r="1.5" fill="#3a2a05"/></g>',
    err: '<g class="fb c-ping"><rect x="104" y="-2" width="14" height="16" rx="5" fill="#ff8a8a"/><path d="M108.5 3 L114.5 9 M114.5 3 L108.5 9" stroke="#3a0a0a" stroke-width="1.8" stroke-linecap="round"/></g>',
    think: '<circle class="c-d1" cx="104" cy="14" r="2" fill="#a3a3ad"/><circle class="c-d2" cx="112" cy="8" r="2.6" fill="#a3a3ad"/><circle class="c-d3" cx="120" cy="3" r="3.2" fill="#a3a3ad"/>',
    arcs: '<g fill="none" stroke="#7ff0c8" stroke-width="1.8" stroke-linecap="round"><path class="fb c-a1" d="M114 52 Q120 60 114 68"/><path class="fb c-a2" d="M120 46 Q130 60 120 74"/><path class="fb c-a3" d="M46 52 Q40 60 46 68"/><path class="fb c-a4" d="M40 46 Q30 60 40 74"/></g>',
    spark: '<g fill="#ffe9a8"><path class="fb c-s1" d="M28 24 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z"/><path class="fb c-s2" d="M112 24 l1.6 4 4 1.6 -4 1.6 -1.6 4 -1.6 -4 -4 -1.6 4 -1.6z"/><path class="fb c-s3" d="M114 84 l1.2 3 3 1.2 -3 1.2 -1.2 3 -1.2 -3 -3 -1.2 3 -1.2z"/></g>',
    wave: '<g class="c-arm"><path d="M98 82 Q112 78 114 62" fill="none" stroke="#fbfaf7" stroke-width="10" stroke-linecap="round"/><circle cx="114" cy="60" r="6.5" fill="#fbfaf7"/><circle cx="112.5" cy="59" r="1.1" fill="#f3a1aa"/><circle cx="116" cy="59" r="1.1" fill="#f3a1aa"/><circle cx="114.2" cy="62.6" r="1.4" fill="#f3a1aa"/></g>',
    box: '<g class="fb c-peek"><path d="M10 84 L110 84 L106 110 Q106 114 102 114 L18 114 Q14 114 14 110 Z" fill="#b98a5a"/><path d="M10 84 L110 84 L108 90 L12 90 Z" fill="#cfa06c"/><rect x="46" y="96" width="28" height="6" rx="3" fill="#8f673c" opacity=".7"/></g>',
  };
  // signs that sit on the body are drawn inside it, the rest (z, notes, arcs, spark, wave) around it
  const onBody = ['sweat', 'tear'];
  const x = (list) => list.map((k) => `<g class="cx cx-${k}">${extras[k]}</g>`).join('');
  const leg = (name, step, rx, w, fur) => `<g class="c-${name}"><g class="${step}"><rect x="${rx}" y="43" width="${w}" height="10.4" rx="${w / 2}" fill="${fur}"/><ellipse cx="${rx + w / 2 + 0.5}" cy="52.6" rx="${w / 2 + 0.7}" ry="1.9" fill="${fur}"/></g></g>`;
  const tail = 'M15 41 C8 40 4 32 5.5 22.5 C6 19.5 7.2 17.6 9 16.6';
  // the drawing is in 64 x 56 units
  return `<svg class="cat" data-mood="idle" viewBox="-8 -4 136 120" role="img" aria-label="Nikki ist wach">
<g class="fbb c-body"><g transform="translate(2 12) scale(1.8)">
${leg('lb2', 'c-leg2', 22, 5.6, '#ddd8d1')}${leg('lf2', 'c-leg1', 36, 5.6, '#ddd8d1')}
<g class="c-tail"><g class="c-sway"><path d="${tail}" fill="none" stroke="${CAT_TABBY}" stroke-width="4.8" stroke-linecap="round"/><path d="${tail}" fill="none" stroke="${CAT_STRIPE}" stroke-width="4.8" stroke-dasharray="1.4 5"/><circle cx="9" cy="16.6" r="2.4" fill="${CAT_STRIPE}"/></g></g>
<g class="c-torso"><path d="${CAT_BODY}" fill="url(#nbFur)"/><g clip-path="url(#nbBodyClip)"><path d="M17 29 L33 29 C34 34 33 39 29 40 C25 41 23 38 20 38.5 C17 39 15 36 15 34Z" fill="${CAT_TABBY}"/><path d="M22 31 L21.6 36.5 M27 31 L27 37.5" fill="none" stroke="${CAT_STRIPE}" stroke-width="1.2" stroke-linecap="round"/><ellipse cx="15.5" cy="45" rx="3.6" ry="4.2" fill="${CAT_TABBY}"/></g></g>
${leg('lb1', 'c-leg1', 16, 5.8, '#fbfaf7')}${leg('lf1', 'c-leg2', 30, 5.8, '#fbfaf7')}
${catHead()}
</g>${x(onBody)}</g>
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
.cat { display: block; width: 100%; height: 100%; overflow: visible; transform-origin: 50% 100%; transition: scale 0.18s cubic-bezier(0.23, 1, 0.32, 1), rotate 0.14s ease-out; }
.cat .fb { transform-box: fill-box; transform-origin: center; }
.cat .fbb { transform-box: fill-box; transform-origin: 50% 100%; }
.cat .fbt { transform-box: fill-box; transform-origin: 50% 0; }
.cat .c-torso, .cat .c-head, .cat .c-tail, .cat .c-sway, .cat .c-earL, .cat .c-earR, .cat .c-lb1, .cat .c-lb2, .cat .c-lf1, .cat .c-lf2 { transform-box: view-box; }
.cat .c-torso, .cat .c-head, .cat .c-tail, .cat .c-lb1, .cat .c-lb2, .cat .c-lf1, .cat .c-lf2 { transition: transform 0.35s ease-in-out; }
.cat .c-torso { transform-origin: 14px 46px; }
.cat .c-head { transform-origin: 38px 38px; }
.cat .c-tail, .cat .c-sway { transform-origin: 15px 40px; }
.cat .c-sway { animation: ct-tail 2.8s ease-in-out infinite; }
.cat .c-lb1 { transform-origin: 19.1px 43px; }
.cat .c-lb2 { transform-origin: 25px 43px; }
.cat .c-lf1 { transform-origin: 33.1px 43px; }
.cat .c-lf2 { transform-origin: 39px 43px; }
.cat .c-leg1, .cat .c-leg2 { transform-box: fill-box; transform-origin: 50% 0; }
.cat .c-earL { transform-origin: 35px 17px; }
.cat .c-earR { transform-origin: 50px 14px; }
.cat .c-whL { transform-origin: 100% 50%; }
.cat .c-whR { transform-origin: 0 50%; }
.cat .c-arm { transform-box: fill-box; transform-origin: 98px 82px; animation: ct-waveArm 0.7s ease-in-out infinite; }
.cat .ce, .cat .cm, .cat .cx { display: none; }
.cat .c-blush { opacity: 0.4; }
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
  css += rule(pick((l) => l.droop), '.c-wd', 'transform: translateY(1.5px);');
  for (const [pose, parts] of Object.entries(CAT_POSES)) {
    const list = pick((l) => (l.pose ?? 'sit') === pose);
    for (const [part, t] of Object.entries(parts)) css += rule(list, `.c-${part}`, `transform: ${t};`);
  }
  css += `.cat[data-mood='music'] .c-sway { animation-duration: 0.9s; }
.cat[data-mood='music'] .c-leg1 { animation: ct-step 0.9s ease-in-out infinite; }
.cat[data-mood='music'] .c-leg2 { animation: ct-step 0.9s ease-in-out -0.45s infinite; }
.cat[data-mood='work'] .c-lf1 .c-leg2 { animation: ct-knead 0.72s ease-in-out infinite; }
.cat[data-mood='work'] .c-lf2 .c-leg1 { animation: ct-knead 0.72s ease-in-out -0.36s infinite; }
.cat[data-mood='need'] .c-sway { animation-duration: 0.9s; }
.cat[data-mood='sleep'] .c-sway { animation-duration: 8s; }
`;
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
    lookA: '0%,12%,100%{transform:translateX(0)}28%,48%{transform:translateX(1.4px)}64%,84%{transform:translateX(-1.4px)}',
    scan: '0%,100%{transform:translateX(-1.2px)}50%{transform:translateX(1.2px)}',
    thinkEyes: '0%,100%{transform:translate(.8px,-1.2px)}50%{transform:translate(1.2px,-1.4px)}',
    tail: '0%,100%{transform:rotate(-6deg)}50%{transform:rotate(8deg)}',
    step: '0%,100%{transform:rotate(14deg)}50%{transform:rotate(-14deg)}',
    knead: '0%,100%{transform:translateY(0)}50%{transform:translateY(-1.6px)}',
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

// a place she was dragged to stays inside the island and below the tabs, whatever size the page has
function catClamp({ left, top }, { w, h, minTop }) {
  return { left: Math.round(Math.min(Math.max(left, 0), w - CAT_W)), top: Math.round(Math.max(Math.min(top, h - CAT_H), minTop)) };
}

// the tab icon's shrunk-cat landing: centred on the button
function catIconBox(btn, box) {
  const r = catOffset(btn, box);
  return { left: Math.round(r.x + r.w / 2 - CAT_W / 2), top: Math.round(r.y + r.h / 2 - CAT_H + 11.5) };
}

// where the user dragged her, per view; only this renderer needs it
const CAT_PLACES_KEY = 'nikki.catPlaces';
function catReadPlaces() {
  try {
    const all = JSON.parse(localStorage.getItem(CAT_PLACES_KEY)) ?? {};
    return Object.fromEntries(Object.entries(all).filter(([, p]) => Number.isFinite(p?.left) && Number.isFinite(p?.top)));
  } catch {
    return {};
  }
}
function catSavePlaces(places) {
  try {
    localStorage.setItem(CAT_PLACES_KEY, JSON.stringify(places));
  } catch {}
}

const CAT_EASE = 'cubic-bezier(0.45, 0, 0.55, 1)';
const CAT_EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';

// Her head behind the closed notch: she looks out now and then and when something happens, on one side, never in front of the eyes.
// Nothing here catches the mouse. while: moods she stays out for; visit: moods that bring her out for a moment.
const CAT_PEEK_WHILE = ['need', 'listen'];
const CAT_PEEK_VISIT = ['done', 'error'];
const CAT_PEEK_MS = 3400;
function catPeekShow({ mood, last, hover, visiting }) {
  return hover || visiting || CAT_PEEK_WHILE.includes(mood) || (mood !== last && CAT_PEEK_VISIT.includes(mood));
}
function createNotchPeek(host, island) {
  host.innerHTML = `<div class="peekCat">${catHeadSvg()}</div>`;
  const svg = host.querySelector('.cat');
  let now = { mood: 'idle', hover: false, blocked: true };
  let until = 0;
  let timer = 0;
  function paint() {
    const visiting = Date.now() < until;
    const on = !now.blocked && (visiting || now.hover || CAT_PEEK_WHILE.includes(now.mood));
    if (on && !host.dataset.side) host.dataset.side = island.dataset.peek = Math.random() < 0.5 ? 'L' : 'R';
    if (!on) delete island.dataset.peek;
    host.toggleAttribute('data-on', on);
    if (!on) delete host.dataset.side;
    svg.dataset.mood = now.mood;
  }
  function visit(ms = CAT_PEEK_MS) {
    until = Date.now() + ms;
    clearTimeout(timer);
    timer = setTimeout(paint, ms);
    paint();
  }
  (function idle() {
    setTimeout(() => {
      if (!now.blocked) visit();
      idle();
    }, 45000 + Math.random() * 75000);
  })();
  return {
    update({ glow, hover, sleeping, open }) {
      const mood = catMoodFor(glow);
      const last = now.mood;
      now = { mood, hover, blocked: open || (sleeping && !hover) };
      if (catPeekShow({ mood, last }) && !now.blocked && CAT_PEEK_VISIT.includes(mood)) visit();
      else paint();
    },
  };
}

function createCatStage({ box, tabs, ctx, reduceMotion = false, canJump = () => true, voice = () => {} }) {
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
  let press = null; // the mouse holds her: { x, y, left, top, lastX, dragging }
  let custom = catReadPlaces(); // view → { left, top } where the user put her
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

  const bounds = () => ({ w: box.offsetWidth, h: box.offsetHeight, minTop: catOffset(tabs, box).y + tabs.offsetHeight + 2 });
  function sync() {
    if (press?.dragging) return { type: 'sit', left: rest.offsetLeft, top: rest.offsetTop }; // she is in the hand
    const mine = custom[view];
    const s = mine ? { type: 'sit', ...catClamp(mine, bounds()) } : catSpot(view, ctx());
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

  // ---- the mouse: pressing squashes her, a click makes her hop and answer, dragging gives her a new place in this view
  const body = inner(rest);
  const face = svgOf(rest);
  const still = () => face.getAnimations().forEach((x) => x.cancel());
  // spring in keyframes: launch, apex, landing squash, a small rebound. Rise eases out, the fall eases in like gravity.
  function hop(height, turn = 0) {
    if (reduceMotion) return;
    still();
    const at = (y, r, sx, sy) => `translateY(${y}px) rotate(${r}deg) scale(${sx}, ${sy})`;
    face.animate(
      [
        { transform: at(0, 0, 1.1, 0.86), easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)' },
        { transform: at(-height * 0.62, turn * 0.3, 0.9, 1.14), offset: 0.16, easing: 'cubic-bezier(0.2, 0.7, 0.4, 1)' },
        { transform: at(-height, turn * 0.6, 0.97, 1.03), offset: 0.42, easing: 'cubic-bezier(0.5, 0, 0.8, 0.5)' },
        { transform: at(0, turn, 1.14, 0.84), offset: 0.7, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)' },
        { transform: at(-3, turn, 0.97, 1.04), offset: 0.85, easing: 'ease-in-out' },
        { transform: at(0, turn, 1, 1) },
      ],
      { duration: turn ? 760 : 560 },
    );
  }
  function react() {
    const now = Date.now();
    clicks = clicks.filter((t) => now - t < 2200).concat(now);
    const n = clicks.length;
    if (n >= 3) clicks = [];
    const [m, ms, h, turn, say] = n >= 3 ? ['dizzy', 2200, 26, 360, 'mrow'] : n === 2 ? ['love', 1500, 22, 0, 'chirp'] : ['purr', 1300, 16, 0, 'mrrp'];
    touch(m, ms);
    hop(h, turn);
    voice(say);
  }
  function move(left, top) {
    const p = catClamp({ left, top }, bounds());
    rest.style.left = `${p.left}px`;
    rest.style.top = `${p.top}px`;
  }
  function pickUp() {
    press.dragging = true;
    still();
    rest.dataset.type = 'sit';
    rest.style.height = `${CAT_H}px`;
    rest.classList.add('held');
    touch('surprised', 0);
    voice('lift');
  }
  let tiltTimer = null;
  function letGo() {
    const p = press;
    press = null;
    clearTimeout(tiltTimer);
    face.style.rotate = '';
    if (!p?.dragging) return;
    rest.classList.remove('held');
    custom[view] = { left: rest.offsetLeft, top: rest.offsetTop };
    catSavePlaces(custom);
    touch('purr', 1100);
    hop(8);
    voice('land');
  }
  body.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || busy) return;
    body.setPointerCapture(e.pointerId);
    clearTimeout(hoverTimer);
    press = { x: e.clientX, y: e.clientY, left: rest.offsetLeft, top: rest.offsetTop, lastX: e.clientX, dragging: false };
    if (reduceMotion) return;
    still();
    face.animate([{ transform: 'scale(1, 1)' }, { transform: 'scale(1.1, 0.86)' }], { duration: 110, easing: CAT_EASE_OUT, fill: 'forwards' });
  });
  body.addEventListener('pointermove', (e) => {
    if (!press) return;
    if (!e.buttons) return letGo(); // the button came up outside the window
    const dx = e.clientX - press.x;
    const dy = e.clientY - press.y;
    if (!press.dragging) {
      if (Math.hypot(dx, dy) < 5) return;
      pickUp();
    }
    move(press.left + dx, press.top + dy);
    // she swings behind the hand and settles when it stops
    face.style.rotate = `${Math.max(-16, Math.min(16, (e.clientX - press.lastX) * 2.2))}deg`;
    press.lastX = e.clientX;
    clearTimeout(tiltTimer);
    tiltTimer = setTimeout(() => (face.style.rotate = ''), 90);
  });
  body.addEventListener('pointerup', () => {
    const clicked = press && !press.dragging;
    letGo();
    if (clicked) react();
  });
  body.addEventListener('pointercancel', letGo);
  body.addEventListener('lostpointercapture', letGo);
  body.addEventListener('mouseenter', () => {
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(() => !press && touch('love', 0), 2000);
  });
  body.addEventListener('mouseleave', () => {
    clearTimeout(hoverTimer);
    if (touchMood === 'love') touch(null, 0);
  });
  // a double click sends her back to the place the page has for her
  body.addEventListener('dblclick', () => {
    if (!custom[view]) return;
    const was = { left: rest.offsetLeft, top: rest.offsetTop };
    delete custom[view];
    catSavePlaces(custom);
    sync();
    if (!reduceMotion) rest.animate([{ transform: `translate(${was.left - rest.offsetLeft}px, ${was.top - rest.offsetTop}px)` }, { transform: 'none' }], { duration: 320, easing: CAT_EASE });
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
    hide(on) {
      rest.style.visibility = on ? 'hidden' : '';
    },
    restRect: () => rest.getBoundingClientRect(),
    resetPlaces() {
      custom = {};
      catSavePlaces(custom);
      sync();
    },
    mood,
  };
}
