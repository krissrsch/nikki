// The start of Nikki, all inside the island: it springs open to a wide black banner, she falls in from the notch with a little storm of
// light, lands, jumps for joy, and the banner opens into Home while she hops to her place.
// Classic script (globals) like cat.js. Anything that opens the island meanwhile (a click, the hotkey, a permission card) ends it at once.

const INTRO_MS = 2000; // her dance, from the first frame of the banner to the opening of Home

// light that falls in, then one ring of dots from where she lands. shortcut: a fixed 640x150 canvas, the banner has that size
function introParticles(canvas) {
  const ctx = canvas.getContext('2d');
  const r = (a, b) => a + Math.random() * (b - a);
  const streaks = Array.from({ length: 46 }, () => ({ x: r(30, 610), speed: r(0.32, 0.62), len: r(8, 22), alpha: r(0.15, 0.5), t0: r(0, 300) }));
  const ring = Array.from({ length: 70 }, () => ({ a: r(0, Math.PI * 2), j: r(0.9, 1.1), size: r(0.8, 1.6), alpha: r(0.35, 0.9) }));
  const start = performance.now();
  let raf = 0;
  const frame = (now) => {
    const t = now - start;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff';
    if (t < 620) {
      const fade = Math.min(1, (620 - t) / 180);
      for (const s of streaks) {
        const y = (t - s.t0) * s.speed;
        if (y <= 0) continue;
        ctx.globalAlpha = s.alpha * fade;
        ctx.fillRect(s.x, y - s.len, 1, s.len);
      }
    }
    const k = Math.min(1, Math.max(0, (t - 560) / 1300));
    if (k > 0 && k < 1) {
      const out = 1 - (1 - k) ** 3;
      const rx = 14 + 340 * out;
      for (const d of ring) {
        ctx.globalAlpha = d.alpha * (1 - k);
        ctx.fillRect(320 + Math.cos(d.a) * rx * d.j, 92 + Math.sin(d.a) * rx * 0.3 * d.j, d.size, d.size);
      }
    }
    if (t < 2000) raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return () => cancelAnimationFrame(raf);
}

async function playIntro({ island, glow, clip, cat, say, open }) {
  const stage = document.createElement('div');
  stage.id = 'introStage';
  stage.innerHTML = `<canvas width="640" height="150"></canvas><div class="introCat">${catSvg()}</div>`;
  island.append(stage);
  const body = stage.querySelector('.introCat');
  const face = body.querySelector('.cat');
  const ended = () => island.classList.contains('open');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  let stop = () => {};
  const finish = () => {
    stop();
    stage.remove();
    island.classList.remove('greeting');
    clip.classList.remove('sweeping');
    glow.dataset.glow = '';
    cat.hide(false);
  };

  cat.hide(true);
  island.classList.remove('boot');
  await wait(320);
  if (ended()) return finish();

  island.classList.add('greeting');
  stop = introParticles(stage.querySelector('canvas'));
  glow.dataset.glow = 'intro';
  clip.classList.add('sweeping');
  // she falls out of the notch, the landing squashes her, she bounces once; later she crouches and jumps for joy
  const pose = (at, y, sx, sy, easing, opacity = 1) => ({ offset: at / INTRO_MS, transform: `translateY(${y}px) scale(${sx}, ${sy})`, easing, opacity });
  const IN = 'cubic-bezier(0.55, 0, 0.9, 0.45)';
  const OUT = 'cubic-bezier(0.2, 0.8, 0.3, 1)';
  const BOTH = 'cubic-bezier(0.45, 0, 0.55, 1)';
  body.animate(
    [
      pose(0, -74, 0.3, 0.3, 'linear', 0),
      pose(200, -74, 0.3, 0.3, IN),
      pose(600, 8, 1.14, 0.86, OUT),
      pose(730, -13, 0.92, 1.16, BOTH),
      pose(900, 0, 1, 1, BOTH),
      pose(1200, 0, 1, 1, IN),
      pose(1300, 16, 1.13, 0.87, OUT),
      pose(1450, -26, 0.86, 1.22, IN),
      pose(1600, 2, 1.08, 0.92, BOTH),
      pose(1740, 0, 1, 1, 'linear'),
      pose(INTRO_MS, 0, 1, 1, 'linear'),
    ],
    { duration: INTRO_MS, fill: 'both' },
  );
  await wait(560);
  if (ended()) return finish();
  face.dataset.mood = 'done';
  say('hello');
  await wait(340);
  if (ended()) return finish();
  face.dataset.mood = 'idle';
  await wait(400);
  if (ended()) return finish();
  face.dataset.mood = 'done';
  await wait(700);
  glow.dataset.glow = '';
  if (ended()) return finish();

  // the banner opens into Home, she hops to where she lives
  open();
  island.classList.remove('greeting');
  cat.sync();
  const from = body.getBoundingClientRect();
  const to = cat.restRect();
  const dx = to.left - from.left;
  const dy = to.top - from.top;
  body.getAnimations().forEach((a) => a.cancel());
  body.style.opacity = 1;
  const flight = body.animate(
    [
      { transform: 'translate(0, 0)', easing: OUT },
      { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 22}px)`, offset: 0.5, easing: IN },
      { transform: `translate(${dx}px, ${dy}px)` },
    ],
    { duration: 520, fill: 'both' },
  );
  await flight.finished.catch(() => {});
  finish();
}
