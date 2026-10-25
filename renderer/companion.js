// The companion: a white cat with black spots living in the island's #stage.
// Body in profile (flipped to face the walking direction), face turned to the viewer.
// GSAP drives everything that reacts (walk cycle, poses, idle habits, state behaviour);
// CSS drives what is predetermined (blinking, zzz). Every SVG pivot is in viewBox units (64 x 56); the cat is drawn chibi-style so it reads at 40px in the bar and ~53px when the island is open.
window.createCompanion = function ({ walker, stage, island, mode = 'bar', pinned = false }) {
  const blob = mode === 'blob';
  const stay = pinned || mode === 'pinned'; // stay centered; no horizontal roam (chat side field)
  const sizer = walker.querySelector('.sizer') || walker.querySelector('#sizer');
  const STROLL = blob ? 14 : 20; // px/s; blob stages are short — soft steps, not patrols
  const TROT = blob ? 42 : 64;
  const SLEEP_AFTER = blob ? 28 : 45;
  const MOODS = ['happy', 'annoyed', 'dizzy', 'yawning', 'licking'];
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const q = (s) => walker.querySelector(s);
  const face = q('.face') || q('#face');
  const all = q('.all');
  const torso = q('.torso');
  const head = q('.head');
  const tail = q('.tail');
  const look = q('.look');
  const earB = q('.earB');
  const earF = q('.earF');
  const lb1 = q('.lb1'); // near back leg
  const lb2 = q('.lb2'); // far back leg
  const lf1 = q('.lf1'); // near front leg
  const lf2 = q('.lf2'); // far front leg
  const backLegs = [lb1, lb2];
  const frontLegs = [lf1, lf2];

  gsap.set(lb1, { svgOrigin: '19.1 43' });
  gsap.set(lb2, { svgOrigin: '25 43' });
  gsap.set(lf1, { svgOrigin: '33.1 43' });
  gsap.set(lf2, { svgOrigin: '39 43' });
  gsap.set(torso, { svgOrigin: '14 46' }); // rump: sitting rotates around it
  gsap.set(tail, { svgOrigin: '15 40' });
  gsap.set(head, { svgOrigin: '38 38' }); // neck
  gsap.set(earB, { svgOrigin: '35 17' });
  gsap.set(earF, { svgOrigin: '50 14' });
  gsap.set(look, { svgOrigin: '42 27' });
  gsap.set(all, { svgOrigin: '30 54' }); // feet: squash from the ground

  // ---- poses (values derived by rotating the chest points around the rump)
  const POSES = {
    stand: { torso: { rotation: 0, y: 0, scaleY: 1 }, head: { x: 0, y: 0, rotation: 0 }, lb: [{ x: 0, y: 0, scaleY: 1, rotation: 0 }, { x: 0, y: 0, scaleY: 1, rotation: 0 }], lf: [{ x: 0, y: 0, scaleY: 1, rotation: 0 }, { x: 0, y: 0, scaleY: 1, rotation: 0 }], tail: { x: 0, y: 0, rotation: 0 } },
    sit: { torso: { rotation: -10, y: 0, scaleY: 1 }, head: { x: -1.75, y: -4.05, rotation: 0 }, lb: [{ x: 0, y: 0, scaleY: 0.3, rotation: 0 }, { x: 0, y: 0, scaleY: 0.3, rotation: 0 }], lf: [{ x: -0.8, y: -6.25, scaleY: 1.57, rotation: 0 }, { x: -0.9, y: -7.3, scaleY: 1.66, rotation: 0 }], tail: { x: -1, y: 0, rotation: 22 } },
    loaf: { torso: { rotation: 0, y: 4.5, scaleY: 1 }, head: { x: -1, y: 5, rotation: 4 }, lb: [{ x: 0, y: 0, scaleY: 0.12, rotation: 0 }, { x: 0, y: 0, scaleY: 0.12, rotation: 0 }], lf: [{ x: 0, y: 0, scaleY: 0.12, rotation: 0 }, { x: 0, y: 0, scaleY: 0.12, rotation: 0 }], tail: { x: 7, y: 5, rotation: 108 } }, // tail tucked under, tip peeks out at the chest
  };
  let posture = 'stand';
  function pose(name, d = 0.35) {
    posture = name;
    const p = POSES[name];
    const t = { duration: still ? 0 : d, ease: 'power2.inOut', overwrite: 'auto' };
    gsap.to(torso, { ...p.torso, ...t });
    gsap.to(head, { ...p.head, ...t });
    gsap.to(tail, { ...p.tail, ...t });
    backLegs.forEach((l, i) => gsap.to(l, { ...p.lb[i], ...t }));
    frontLegs.forEach((l, i) => gsap.to(l, { ...p.lf[i], ...t }));
  }

  // ---- walk cycle: diagonal pairs swing together, body and head bob twice per stride
  const walkTl = gsap.timeline({ repeat: -1, paused: true });
  walkTl
    .fromTo([lb1, lf2], { rotation: 18 }, { rotation: -18, duration: 0.21, ease: 'sine.inOut' }, 0)
    .fromTo([lb2, lf1], { rotation: -18 }, { rotation: 18, duration: 0.21, ease: 'sine.inOut' }, 0)
    .to([lb1, lf2], { rotation: 18, duration: 0.21, ease: 'sine.inOut' }, 0.21)
    .to([lb2, lf1], { rotation: -18, duration: 0.21, ease: 'sine.inOut' }, 0.21)
    .to(torso, { y: -0.8, duration: 0.105, repeat: 3, yoyo: true, ease: 'sine.inOut' }, 0)
    .to(head, { y: -0.9, duration: 0.105, repeat: 3, yoyo: true, ease: 'sine.inOut' }, 0.04);
  function walking(on, speed = 1) {
    if (still) return;
    if (on) {
      if (posture !== 'stand') pose('stand', 0.2);
      walkTl.timeScale(speed).play(0.105); // mid-stride: all legs at 0°, so starting never snaps
    } else {
      walkTl.pause();
      gsap.to([lb1, lb2, lf1, lf2], { rotation: 0, duration: 0.15, ease: 'power2.out' });
      gsap.to([torso, head], { y: 0, duration: 0.15 });
    }
  }

  // ---- tail: always alive; the state sets how much
  const tailTl = gsap.timeline({ repeat: -1, yoyo: true });
  if (!still) tailTl.fromTo(q('.tail .sway'), { rotation: -6, svgOrigin: '15 40' }, { rotation: 8, svgOrigin: '15 40', duration: 1.4, ease: 'sine.inOut' });
  const tailMood = (speed) => tailTl.timeScale(speed);

  // ---- position along the stage
  const pos = { x: 0 };
  const scaleNow = () => {
    if (blob) return 1;
    return sizer.getBoundingClientRect().width / Math.max(walker.offsetWidth, 1); // 1 collapsed, 1.32 open
  };
  const maxX = () => {
    if (stay) return 0; // pinned: no horizontal travel
    return Math.max(0, stage.clientWidth - sizer.getBoundingClientRect().width);
  };
  const place = () => {
    pos.x = Math.min(pos.x, maxX()); // the stage shrinks while the island collapses, even mid-walk
    gsap.set(walker, { x: pos.x });
  };
  let tween;
  let wait;
  function moveTo(x, speed, done) {
    tween?.kill();
    wait?.kill();
    x = Math.min(Math.max(x, 0), maxX());
    gsap.set(face, { scaleX: x >= pos.x ? 1 : -1 });
    if (Math.abs(x - pos.x) < 1) return done?.();
    habitTl?.kill();
    walking(true, Math.min(speed / (STROLL * scaleNow()), 3.2)); // STROLL = one stride per cycle at this size (±18° on 11-unit legs): paws plant instead of sliding
    tween = gsap.to(pos, {
      x,
      duration: still ? 0 : Math.abs(x - pos.x) / speed,
      ease: 'sine.inOut',
      onUpdate: place,
      onComplete: () => {
        walking(false);
        done?.();
      },
    });
  }

  // ---- moods and habits
  let moodTimer;
  let habitTl; // the one running habit; killed when the cat moves or the state changes
  function mood(name, ms) {
    clearTimeout(moodTimer);
    MOODS.forEach((m) => walker.classList.toggle(m, m === name));
    if (ms) moodTimer = setTimeout(() => walker.classList.remove(name), ms);
  }
  const habits = {
    sit: () => pose('sit'),
    yawn() {
      pose('sit');
      mood('yawning', 1300);
      habitTl = gsap.timeline().to(head, { rotation: -12, duration: 0.4, ease: 'power2.out', delay: 0.3 }).to(head, { rotation: 0, duration: 0.4, ease: 'power2.inOut', delay: 0.6 });
    },
    lick() {
      pose('sit');
      habitTl = gsap.timeline({ delay: 0.35 })
        .to(lf1, { rotation: -60, y: -9, duration: 0.3, ease: 'power2.out' })
        .add(() => mood('licking', 1500), '<')
        .to(head, { rotation: 10, duration: 0.18, repeat: 5, yoyo: true, ease: 'sine.inOut' }, '<')
        .to(lf1, { ...POSES.sit.lf[0], duration: 0.3, ease: 'power2.inOut' });
    },
    stretch() {
      pose('stand', 0.2);
      habitTl = gsap.timeline()
        .to(frontLegs, { rotation: -40, duration: 0.45, ease: 'power2.out' })
        .to(torso, { rotation: 9, duration: 0.45, ease: 'power2.out' }, '<') // play bow: chest down around the rump
        .to(head, { y: 3, x: 2, duration: 0.45, ease: 'power2.out' }, '<')
        .to(frontLegs, { rotation: 0, duration: 0.4, ease: 'power2.inOut', delay: 0.5 })
        .to(torso, { rotation: 0, duration: 0.4, ease: 'power2.inOut' }, '<')
        .to(head, { y: 0, x: 0, duration: 0.4, ease: 'power2.inOut' }, '<');
    },
    slowBlink() {
      // double slow-blink = “I like you”
      pose('sit');
      habitTl = gsap.timeline({ delay: 0.25 })
        .to(look, { scaleY: 0.08, duration: 0.55, ease: 'sine.inOut' })
        .to(look, { scaleY: 1, duration: 0.5, ease: 'sine.inOut', delay: 0.35 })
        .to(look, { scaleY: 0.08, duration: 0.45, ease: 'sine.inOut', delay: 0.15 })
        .to(look, { scaleY: 1, duration: 0.55, ease: 'sine.inOut', delay: 0.25 })
        .add(() => mood('happy', 900));
    },
    lookAround() {
      habitTl = gsap.timeline()
        .to(look, { x: -1.8, duration: 0.35, ease: 'power2.out' })
        .to(head, { rotation: -6, duration: 0.35, ease: 'power2.out' }, '<')
        .to(look, { x: 1.8, duration: 0.45, delay: 0.5, ease: 'power2.inOut' })
        .to(head, { rotation: 8, duration: 0.45, ease: 'power2.inOut' }, '<')
        .to(look, { x: 0, duration: 0.3, delay: 0.45, ease: 'power2.out' })
        .to(head, { rotation: 0, duration: 0.3, ease: 'power2.out' }, '<');
    },
    headTilt() {
      pose('sit');
      mood('happy', 1600);
      habitTl = gsap.timeline()
        .to(head, { rotation: 14, x: 1.2, duration: 0.45, ease: 'power2.out' })
        .to(earF, { rotation: 10, duration: 0.35, ease: 'sine.out' }, '<0.05')
        .to(earB, { rotation: -6, duration: 0.35, ease: 'sine.out' }, '<')
        .to(head, { rotation: 14, duration: 0.7 }) // hold the cute tilt
        .to(head, { rotation: 0, x: 0, duration: 0.5, ease: 'power2.inOut' })
        .to([earF, earB], { rotation: 0, duration: 0.4, ease: 'power2.out' }, '<');
    },
    wiggle() {
      pose('sit', 0.2);
      mood('happy', 1400);
      habitTl = gsap.timeline()
        .to(all, { rotation: -5, duration: 0.12, ease: 'sine.inOut' })
        .to(all, { rotation: 6, duration: 0.14, ease: 'sine.inOut' })
        .to(all, { rotation: -4, duration: 0.12, ease: 'sine.inOut' })
        .to(all, { rotation: 3, duration: 0.12, ease: 'sine.inOut' })
        .to(all, { rotation: 0, duration: 0.35, ease: 'elastic.out(1, 0.55)' })
        .to(tail, { rotation: 18, duration: 0.2 }, 0)
        .to(tail, { rotation: 0, duration: 0.55, ease: 'power2.out' }, 0.55);
    },
    softBounce() {
      pose('sit', 0.15);
      mood('happy', 1200);
      habitTl = gsap.timeline()
        .to(all, { scaleY: 0.88, scaleX: 1.08, duration: 0.16, ease: 'power2.out' })
        .to(all, { scaleY: 1.08, scaleX: 0.94, y: -6, duration: 0.28, ease: 'power2.out' })
        .to(all, { scaleY: 0.94, scaleX: 1.04, y: 0, duration: 0.16, ease: 'power2.in' })
        .to(all, { scaleY: 1, scaleX: 1, duration: 0.45, ease: 'elastic.out(1, 0.5)' });
    },
    pawTap() {
      pose('sit');
      habitTl = gsap.timeline({ delay: 0.2 })
        .to(lf1, { y: '-=3.5', rotation: -12, duration: 0.14, ease: 'power2.out' })
        .to(lf1, { y: '+=3.5', rotation: 0, duration: 0.14, ease: 'power2.in' })
        .to(lf1, { y: '-=3.5', rotation: -12, duration: 0.14, ease: 'power2.out' })
        .to(lf1, { y: '+=3.5', rotation: 0, duration: 0.14, ease: 'power2.in' })
        .to(lf2, { y: '-=2.5', duration: 0.12, ease: 'power2.out' })
        .to(lf2, { y: '+=2.5', duration: 0.14, ease: 'power2.in' })
        .add(() => mood('happy', 700));
    },
  };
  // blob leans cute; bar keeps a mix so the notch stays lively but not chaotic
  const HABITS = blob
    ? ['headTilt', 'headTilt', 'slowBlink', 'slowBlink', 'wiggle', 'softBounce', 'pawTap', 'lookAround', 'lick', 'yawn', 'sit', null]
    : ['sit', 'sit', 'yawn', 'lick', 'stretch', 'slowBlink', 'lookAround', 'headTilt', 'wiggle', null, null];

  function earTwitch() {
    if (!still && !sleeping && state !== 'error') {
      const both = Math.random() < 0.28;
      const tl = gsap.timeline();
      if (both) {
        tl.to(earF, { rotation: 12, duration: 0.08, ease: 'power2.out' }, 0)
          .to(earB, { rotation: -12, duration: 0.08, ease: 'power2.out' }, 0)
          .to([earF, earB], { rotation: 0, duration: 0.45, ease: 'elastic.out(1, 0.45)' });
      } else {
        const ear = Math.random() < 0.5 ? earF : earB;
        tl.to(ear, { rotation: ear === earF ? 14 : -14, duration: 0.08 })
          .to(ear, { rotation: 0, duration: 0.4, ease: 'elastic.out(1, 0.45)' });
      }
    }
    gsap.delayedCall((blob ? 3.2 : 5) + Math.random() * (blob ? 5 : 9), earTwitch);
  }

  // ---- wandering (blob: short hops + habits in place — Coucou-like presence, not bar patrol)
  let state = 'idle';
  let sleeping = false;
  let idleBob;
  function startBlobIdle() {
    if (!blob || still || idleBob) return;
    // soft breathe: lift + tiny squash so she feels plush, not rigid
    idleBob = gsap.timeline({ repeat: -1, yoyo: true })
      .to(all, { y: -3.2, scaleY: 1.03, scaleX: 0.985, duration: 1.55, ease: 'sine.inOut' }, 0)
      .to(head, { y: '-=0.6', duration: 1.55, ease: 'sine.inOut' }, 0);
  }
  function stopBlobIdle() {
    idleBob?.kill();
    idleBob = null;
    if (blob) {
      gsap.to(all, { y: 0, scaleX: 1, scaleY: 1, duration: 0.28, ease: 'power2.out' });
      gsap.to(head, { y: 0, duration: 0.28, ease: 'power2.out' });
    }
  }
  function wander() {
    if (still || sleeping || state === 'needsYou' || state === 'working' || state === 'thinking') return;
    if (blob) {
      // pinned (chat field): only in-place habits + bob — never leave the box
      if (stay) {
        startBlobIdle();
        const habit = HABITS[Math.floor(Math.random() * HABITS.length)];
        if (habit && state === 'idle' && Math.random() < 0.75) {
          stopBlobIdle();
          habits[habit]();
          wait = gsap.delayedCall(3.2 + Math.random() * 2.8, () => {
            if (state === 'idle' && !sleeping) startBlobIdle();
            wander();
          });
        } else {
          wait = gsap.delayedCall(2.5 + Math.random() * 3, wander);
        }
        return;
      }
      // ~70% cute habit, ~30% tiny hop — presence stays sweet
      const rollCute = Math.random() < 0.72;
      const habit = HABITS[Math.floor(Math.random() * HABITS.length)];
      if (rollCute && habit && state === 'idle') {
        stopBlobIdle();
        habits[habit]();
        wait = gsap.delayedCall(3.2 + Math.random() * 2.8, () => {
          if (state === 'idle' && !sleeping) startBlobIdle();
          wander();
        });
      } else {
        startBlobIdle();
        const span = maxX();
        const target = span < 8 ? 0 : Math.random() * span;
        moveTo(target, STROLL, () => {
          wait = gsap.delayedCall(2 + Math.random() * 2.5, wander);
        });
      }
      return;
    }
    let target = Math.random() * maxX();
    if (Math.abs(target - pos.x) < 14) target = maxX() - target;
    moveTo(target, STROLL * scaleNow(), () => {
      const habit = HABITS[Math.floor(Math.random() * HABITS.length)];
      if (habit && state === 'idle') habits[habit]();
      wait = gsap.delayedCall(3 + Math.random() * 5, wander);
    });
  }

  // ---- sleep
  let sleepTimer;
  function armSleep() {
    sleepTimer?.kill();
    if (state === 'idle' || state === 'done') sleepTimer = gsap.delayedCall(SLEEP_AFTER, fallAsleep);
  }
  let breathe;
  function fallAsleep() {
    sleeping = true;
    tween?.kill();
    wait?.kill();
    walking(false);
    pose('loaf', 0.8);
    walker.classList.add('sleeping');
    tailMood(0.3);
    gsap.to(look, { x: 0, y: 0, duration: 0.6 });
    if (!still) breathe = gsap.to(torso, { scaleY: 1.05, duration: 1.8, repeat: -1, yoyo: true, ease: 'sine.inOut', delay: 0.8 });
  }
  function wake() {
    armSleep();
    if (!sleeping) return;
    sleeping = false;
    breathe?.kill();
    gsap.set(torso, { scaleY: 1 });
    walker.classList.remove('sleeping');
    tailMood(1);
    habits.stretch();
    wait = gsap.delayedCall(1.6, wander);
  }

  // ---- input: cursor (screen-wide, from main) and pokes
  const lookX = gsap.quickTo(look, 'x', { duration: 0.4, ease: 'power3.out' });
  const lookY = gsap.quickTo(look, 'y', { duration: 0.4, ease: 'power3.out' });
  function lookAt(px, py) {
    if (sleeping || still) return;
    const r = sizer.getBoundingClientRect();
    const front = gsap.getProperty(face, 'scaleX') > 0 ? 0.66 : 0.34; // the face sits at the front of the body
    const dx = px - (r.left + r.width * front);
    const dy = py - (r.top + r.height * 0.48);
    const d = Math.hypot(dx, dy) || 1;
    const reach = Math.min(1, d / 120);
    lookX((dx / d) * 1.6 * reach * gsap.getProperty(face, 'scaleX'));
    lookY((dy / d) * 1.2 * reach);
  }

  let pokes = [];
  function poke() {
    wake();
    stopBlobIdle();
    const now = performance.now();
    pokes = pokes.filter((t) => now - t < 1200);
    pokes.push(now);
    if (still) return mood(pokes.length >= 3 ? 'dizzy' : 'happy', 900);
    if (pokes.length >= 3) {
      pokes = [];
      mood('dizzy', 2200);
      gsap.fromTo(all, { rotation: -8 }, { rotation: 8, duration: 0.18, repeat: 7, yoyo: true, ease: 'sine.inOut', onComplete: () => {
        gsap.to(all, { rotation: 0, duration: 0.4, ease: 'elastic.out(1, 0.4)' });
        if (blob && state === 'idle') startBlobIdle();
      } });
      return;
    }
    // first taps: startled-cute, not grumpy
    mood('happy', 900);
    gsap.timeline()
      .to(earB, { rotation: -22, duration: 0.07 })
      .to(earF, { rotation: 22, duration: 0.07 }, '<')
      .to(all, { scaleY: 0.86, scaleX: 1.1, duration: 0.08, ease: 'power2.out' }, '<')
      .to(all, { scaleY: 1.06, scaleX: 0.96, y: -4, duration: 0.22, ease: 'power2.out' })
      .to(all, { scaleY: 1, scaleX: 1, y: 0, duration: 0.45, ease: 'elastic.out(1, 0.45)' })
      .to([earB, earF], { rotation: 0, duration: 0.35, ease: 'power2.out' }, '-=0.35')
      .add(() => { if (blob && state === 'idle' && !sleeping) startBlobIdle(); });
  }
  walker.addEventListener('click', (e) => {
    e.stopPropagation(); // poking the cat must not toggle the island
    poke();
  });
  island.addEventListener('mouseenter', wake);
  new ResizeObserver(place).observe(stage);

  // ---- agent state
  let knead;
  let meow;
  function setState(next) {
    const prev = state;
    state = next;
    if (prev === next && next !== 'done') return;
    wake();
    knead?.kill();
    meow?.kill();
    habitTl?.kill();
    stopBlobIdle();
    walker.classList.remove('meow');
    walker.classList.toggle('focus', next === 'working' || next === 'thinking');
    walker.classList.toggle('needsYou', next === 'needsYou');
    walker.classList.toggle('error', next === 'error');
    if (next !== 'error') gsap.to([earB, earF], { rotation: 0, duration: 0.3 });
    if (next !== 'error') gsap.to(torso, { scaleY: 1, duration: 0.3 });

    if (next === 'thinking' || next === 'working') {
      tween?.kill();
      wait?.kill();
      walking(false);
      pose('sit');
      tailMood(1.8);
      if (!still) knead = gsap.timeline({ repeat: -1, delay: 0.4 }).to(lf1, { y: '-=1.6', duration: 0.18, yoyo: true, repeat: 1, ease: 'sine.inOut' }).to(lf2, { y: '-=1.6', duration: 0.18, yoyo: true, repeat: 1, ease: 'sine.inOut' });
      return;
    }
    if (next === 'needsYou') {
      tailMood(3);
      const afterArrive = () => {
        pose('sit', 0.25);
        if (!still)
          meow = gsap.timeline({ repeat: -1, delay: 0.3, repeatDelay: 0.9 })
            .add(() => walker.classList.add('meow'))
            .to(head, { rotation: -10, duration: 0.15, ease: 'power2.out' })
            .to(head, { rotation: 0, duration: 0.3, ease: 'power2.inOut', delay: 0.35 })
            .add(() => walker.classList.remove('meow'));
        else walker.classList.add('meow');
      };
      if (stay) afterArrive();
      else moveTo(blob ? maxX() * 0.55 : maxX(), TROT * scaleNow(), afterArrive);
      return;
    }
    tailMood(1);
    if (next === 'done') {
      mood('happy', 2800);
      walking(false);
      pose(blob ? 'sit' : 'stand', 0.15);
      if (!still) {
        const hop = stay ? -4 : blob ? -10 : -5; // keep victory hop inside the clipped field
        gsap.timeline()
          .to(all, { scaleY: 0.82, scaleX: 1.1, duration: 0.14, ease: 'power2.out' })
          .to(all, { scaleY: 1.1, scaleX: 0.92, y: hop, duration: 0.26, ease: 'power2.out' })
          .to(tail, { rotation: 28, duration: 0.22 }, '<')
          .to(head, { rotation: 8, duration: 0.22 }, '<')
          .to(all, { scaleY: 0.92, scaleX: 1.06, y: 0, duration: 0.16, ease: 'power2.in' })
          .to(all, { scaleY: 1, scaleX: 1, duration: 0.5, ease: 'elastic.out(1, 0.45)' })
          .to(head, { rotation: 0, duration: 0.35, ease: 'power2.out' }, '-=0.35')
          .to(all, { rotation: -4, duration: 0.1, ease: 'sine.inOut' })
          .to(all, { rotation: 4, duration: 0.12, ease: 'sine.inOut' })
          .to(all, { rotation: 0, duration: 0.28, ease: 'elastic.out(1, 0.5)' })
          .to(tail, { rotation: 0, duration: 0.55, ease: 'power2.inOut' }, '-=0.2');
      }
      wait = gsap.delayedCall(2.6, wander);
      return;
    }
    if (next === 'error') {
      tween?.kill();
      walking(false);
      pose('stand', 0.2);
      gsap.to(earB, { rotation: -34, duration: 0.15 });
      gsap.to(earF, { rotation: 34, duration: 0.15 });
      gsap.to(torso, { scaleY: 1.1, duration: 0.25, ease: 'power2.out' });
      if (!still) gsap.fromTo(all, { x: -1.5 }, { x: 0, duration: 0.6, ease: 'elastic.out(1, 0.25)' });
      return;
    }
    wander();
  }

  pos.x = stay ? 0 : blob ? 4 : maxX() / 2;
  place();
  armSleep();
  gsap.delayedCall(blob ? 2.2 : 4, earTwitch);
  if (blob) {
    pose('sit', 0);
    startBlobIdle();
    wait = gsap.delayedCall(3.5 + Math.random() * 2, wander);
  } else wander();
  return { setState, lookAt, pose, habits, mode, pinned: stay };
};

/** Clone bar Nikki SVG into a blob stage walker (Home / Chat). */
window.mountNikkiBlob = function (walkerEl) {
  const src = document.querySelector('#walker #sizer');
  if (!src || !walkerEl) return null;
  const sizer = src.cloneNode(true);
  sizer.classList.add('sizer');
  sizer.removeAttribute('id');
  sizer.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));
  walkerEl.replaceChildren(sizer);
  return walkerEl;
};
