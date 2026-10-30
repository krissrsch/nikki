// Spectrum under the closed notch (canvas Glow): the helper's 12 bands (0–1, bass first) as 24 bars mirrored around the middle,
// 3 px wide on a 5 px grid, 10 px wider than the notch, growing down out of its lower edge. Canvas coordinates: notch at 577–687, corners r 18.
// Classic script (globals) like glance.js; spectrumBars is pure (spectrum.test.js).

// the notch's lower edge at x: its bottom (36), the round corners, beside the notch the middle of its side
function specTop(x) {
  if (x < 577 || x > 687) return 18;
  if (x < 595) return 18 + Math.sqrt(Math.max(0, 324 - (595 - x) ** 2));
  if (x > 669) return 18 + Math.sqrt(Math.max(0, 324 - (x - 669) ** 2));
  return 36;
}
// [{ x, y, h }]: band i gives the pair left and right of the middle; a full band is 52 px in the middle, ~16 at the edges.
// Each bar starts 2 px inside the notch, so it grows out of the edge rather than below it.
function spectrumBars(levels) {
  return levels.flatMap((v, i) => {
    const h = (12 + 40 * Math.exp(-i / 5)) * Math.min(1, Math.max(0, Number(v) || 0));
    return [630.5 - 5 * i - 3, 633.5 + 5 * i].map((x) => ({ x, y: specTop(x + 1.5) - 2, h }));
  });
}

// Paints into the <g> of the glow: requestAnimationFrame only while bars move; silence (zeros or null) lets them sink, then it stops.
// onSound(): whether something sounds changed (the glow shows its music edge then).
function createSpectrum(group, onSound) {
  const zero = Array(12).fill(0);
  const rects = spectrumBars(zero).map((b) => {
    const r = group.appendChild(document.createElementNS('http://www.w3.org/2000/svg', 'rect'));
    for (const [k, v] of Object.entries({ x: b.x, y: b.y.toFixed(1), width: 3, height: 0, rx: 1.5 })) r.setAttribute(k, v);
    return r;
  });
  let target = zero;
  let shown = zero;
  let sound = false;
  let drawing = false;
  let raf = 0;
  function frame() {
    // eased towards the helper's ~30 frames a second; close enough is the target, so the last frame lands on it
    shown = shown.map((v, i) => (Math.abs(target[i] - v) < 0.004 ? target[i] : v + (target[i] - v) * 0.35));
    spectrumBars(shown).forEach((b, i) => rects[i].setAttribute('height', b.h.toFixed(1)));
    raf = drawing && shown.some((v, i) => v !== target[i]) ? requestAnimationFrame(frame) : 0; // the next band frame starts it again
  }
  const run = () => !raf && drawing && (raf = requestAnimationFrame(frame));
  return {
    get sound() {
      return sound;
    },
    set(bands) {
      target = Array.isArray(bands) && bands.length === 12 ? bands : zero;
      if (target.some((v) => v > 0) !== sound) {
        sound = !sound;
        onSound();
      }
      run();
    },
    // only while the notch is closed and the glow is on (never with reduced motion): hidden bars need no frames
    show(on) {
      drawing = on;
      if (!on) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
      run();
    },
  };
}
