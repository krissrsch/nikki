import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// classic renderer script: the pure part runs in a sandbox, the stage needs a DOM (e2e/cat.e2e.js)
const src = readFileSync(new URL('./cat.js', import.meta.url), 'utf8');
const cat = vm.runInNewContext(`${src}\n({ CAT_MOODS, CAT_LOOK, CAT_IDLE, catMoodFor, catCss, catSvg, catDefs, catSpot, catOffset })`);

test('alle 19 Stimmungen haben Aussehen, Beschriftung und Bewegung', () => {
  assert.equal(cat.CAT_MOODS.length, 19);
  for (const m of cat.CAT_MOODS) {
    const l = cat.CAT_LOOK[m];
    assert.ok(l, m);
    assert.match(l.label, /^Nikki /, m);
    assert.ok(l.eye && l.mouth && l.body, m);
  }
  assert.deepEqual(Object.keys(cat.CAT_LOOK).sort(), [...cat.CAT_MOODS].sort());
});

test('der Leerlauf nutzt nur bekannte Stimmungen und schläft irgendwann ein', () => {
  for (const [m, ms] of cat.CAT_IDLE) assert.ok(cat.CAT_LOOK[m] && ms >= 1000, m);
  assert.ok(cat.CAT_IDLE.some(([m]) => m === 'sleep'));
});

test('der Blick der Notch bestimmt ihre Stimmung', () => {
  assert.equal(cat.catMoodFor('need'), 'need');
  assert.equal(cat.catMoodFor('work'), 'work');
  assert.equal(cat.catMoodFor('done'), 'done');
  assert.equal(cat.catMoodFor('error'), 'error');
  assert.equal(cat.catMoodFor('music'), 'music');
  assert.equal(cat.catMoodFor('voice'), 'listen');
  assert.equal(cat.catMoodFor(null), 'idle');
});

test('cat.css ist aktuell (node scripts/build-cat-css.mjs) und deckt jede Stimmung ab', () => {
  const css = readFileSync(new URL('./cat.css', import.meta.url), 'utf8');
  assert.equal(css.replaceAll('
', '
'), cat.catCss()); // git may hand out CRLF
  for (const m of cat.CAT_MOODS) assert.ok(css.includes(`.cat[data-mood='${m}'] .c-body`), m);
  // every animation it uses is defined
  const defined = new Set([...css.matchAll(/@keyframes (ct-\w+)/g)].map((x) => x[1]));
  for (const [, name] of css.matchAll(/animation: (ct-\w+)/g)) assert.ok(defined.has(name), name);
});

test('das Markup trägt Augen, Münder und Zeichen für jede Stimmung und keine Inline-Styles (CSP)', () => {
  const svg = cat.catSvg();
  for (const m of cat.CAT_MOODS) {
    const l = cat.CAT_LOOK[m];
    assert.ok(svg.includes(`class="ce ce-${l.eye}"`), `${m}: Auge ${l.eye}`);
    assert.ok(svg.includes(`class="cm cm-${l.mouth}"`), `${m}: Mund ${l.mouth}`);
    for (const x of (l.extra ?? '').split(' ').filter(Boolean)) assert.ok(svg.includes(`cx-${x}"`), `${m}: ${x}`);
  }
  assert.ok(!/ style=/.test(svg));
  for (const id of ['nbBody', 'nbWL', 'nbWR', 'nbClip', 'nbPill', 'nbSpiral']) assert.ok(cat.catDefs().includes(`id="${id}"`), id);
  for (const [, id] of svg.matchAll(/href="#(nb\w+)"/g)) assert.ok(cat.catDefs().includes(`id="${id}"`), id);
});

// stand-ins with the layout offsets of a DOM: a box and elements measured inside it
const box = { offsetWidth: 720 };
const el = (x, y, w, h) => ({ offsetLeft: x, offsetTop: y, offsetWidth: w, offsetHeight: h, offsetParent: box });
test('ihr Platz: Home sitzt unten rechts in der Claude-Kachel, Chat lugt über die Eingabe, der Rest über die erste Karte', () => {
  const home = el(16, 62, 344, 164);
  const composer = el(16, 380, 688, 44);
  const page = { firstElementChild: el(16, 90, 688, 200) };
  const ctx = { box, home, composer, pageOf: () => page };
  assert.deepEqual(JSON.parse(JSON.stringify(cat.catSpot('home', ctx))), { type: 'sit', left: 16 + 344 - 93 - 4, top: 62 + 164 - 82 });
  const chat = cat.catSpot('chat', ctx);
  assert.equal(chat.type, 'peek');
  assert.equal(chat.edge, 380);
  assert.ok(chat.left > 200 && chat.left + 93 < 420, 'over the composer, left of the permission buttons at the right edge');
  const other = cat.catSpot('todo', ctx);
  assert.equal(other.type, 'peek');
  assert.equal(other.edge, 90);
  // no page content yet: below the tab bar
  assert.equal(cat.catSpot('timer', { ...ctx, pageOf: () => null }).edge, 62);
});
