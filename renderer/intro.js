// The start of Nikki: the notch wakes up, light runs along the top of the screen, she drops out, waves and hops to her place in the opening island.
// Classic script (globals) like cat.js. Anything that opens the island meanwhile (a click, the hotkey, a permission card) ends it at once.

async function playIntro({ island, glow, clip, notch, cat, say, open }) {
  const over = document.createElement('div');
  over.id = 'introCat';
  over.innerHTML = catSvg();
  over.style.transform = 'translateY(-96px)'; // behind the notch until she drops
  document.body.append(over);
  const face = over.querySelector('.cat');
  const whiskers = [...notch.querySelectorAll('.wh')];
  const ended = () => island.classList.contains('open');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const SPRING = 'cubic-bezier(0.34, 1.56, 0.64, 1)';
  const finish = () => {
    over.remove();
    clip.classList.remove('sweeping');
    cat.hide(false);
  };

  cat.hide(true);
  island.dataset.mood = 'sleep';
  island.classList.remove('boot');
  await wait(420);
  if (ended()) return finish();

  // the light leaves the notch towards both screen edges
  glow.dataset.glow = 'intro';
  clip.classList.add('sweeping');
  await wait(420);
  if (ended()) return finish();

  island.dataset.mood = 'awake';
  for (const w of whiskers) w.animate([{ transform: 'scaleX(0.2)', opacity: 0 }, { transform: 'scaleX(1)', opacity: 1 }], { duration: 420, easing: SPRING });
  await wait(420);
  if (ended()) return finish();

  // she drops out from behind the notch and lands with a squash
  face.dataset.mood = 'surprised';
  over.animate(
    [
      { transform: 'translateY(-96px)', easing: 'cubic-bezier(0.5, 0, 0.8, 0.5)' },
      { transform: 'translateY(0)', offset: 0.62, easing: 'cubic-bezier(0.2, 0.7, 0.4, 1)' },
      { transform: 'translateY(-9px)', offset: 0.8, easing: 'cubic-bezier(0.5, 0, 0.8, 0.5)' },
      { transform: 'translateY(0)' },
    ],
    { duration: 620, fill: 'both' },
  );
  face.animate(
    [{ transform: 'scale(0.94, 1.08)' }, { transform: 'scale(0.94, 1.08)', offset: 0.55 }, { transform: 'scale(1.14, 0.84)', offset: 0.66 }, { transform: 'scale(0.98, 1.03)', offset: 0.82 }, { transform: 'scale(1, 1)' }],
    { duration: 620 },
  );
  await wait(560);
  if (ended()) return finish();
  face.dataset.mood = 'wave';
  say('hello');
  glow.dataset.glow = '';
  await wait(1250);
  if (ended()) return finish();

  // the island opens around her, she hops to where she lives; the island is above her until now
  over.classList.add('front');
  open();
  cat.sync();
  const from = over.getBoundingClientRect();
  const to = cat.restRect();
  const dx = to.left - from.left;
  const dy = to.top - from.top;
  face.dataset.mood = 'done';
  over.getAnimations().forEach((a) => a.cancel());
  const hop = Math.min(40, Math.max(14, dy * 0.3));
  const flight = over.animate(
    [
      { transform: 'translate(0, 0)', easing: 'cubic-bezier(0.2, 0.7, 0.4, 1)' },
      { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - hop}px)`, offset: 0.5, easing: 'cubic-bezier(0.5, 0, 0.8, 0.5)' },
      { transform: `translate(${dx}px, ${dy}px)` },
    ],
    { duration: 560, fill: 'both' },
  );
  await flight.finished.catch(() => {});
  finish();
}
