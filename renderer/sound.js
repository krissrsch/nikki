// Nikki's sounds: soft mallet notes, like a kalimba in a small room. Made in the app, no files.
// A note is a few sine partials: the body rings on, the bright ones die within a moment, that is what makes it sound struck and not electronic.
// Classic script (globals) like glance.js.

// name → notes [freq Hz, start s, volume]. Everything sits in one pentatonic scale, so any two sounds go together.
const NIKKI_SOUNDS = {
  mrrp: [[659, 0, 0.17]],
  chirp: [[659, 0, 0.15], [880, 0.085, 0.17]],
  mrow: [[988, 0, 0.15], [784, 0.09, 0.15], [659, 0.18, 0.16], [523, 0.27, 0.18]],
  lift: [[1047, 0, 0.07]],
  land: [[262, 0, 0.2]],
  needsYou: [[880, 0, 0.18], [659, 0.14, 0.18]],
  done: [[659, 0, 0.16], [880, 0.12, 0.17], [1175, 0.24, 0.18]],
  hello: [[523, 0, 0.15], [659, 0.1, 0.16], [784, 0.2, 0.18]],
};
const NIKKI_PARTIALS = [[1, 1, 0.55], [3.9, 0.2, 0.09], [9.2, 0.05, 0.03]]; // ratio, level, seconds to fade

// the room: half a second of fading, darkened noise, mixed in quietly
function soundRoom(ctx) {
  const buf = ctx.createBuffer(1, Math.round(ctx.sampleRate * 0.5), ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) {
    last += 0.25 * (Math.random() * 2 - 1 - last); // a one-pole low-pass keeps the tail from hissing
    d[i] = last * (1 - i / d.length) ** 3;
  }
  const room = ctx.createConvolver();
  const wet = ctx.createGain();
  room.buffer = buf;
  wet.gain.value = 0.5;
  room.connect(wet).connect(ctx.destination);
  return room;
}

function playSound(ctx, room, name) {
  for (const [freq, at, vol] of NIKKI_SOUNDS[name]) {
    const t = ctx.currentTime + at;
    for (const [ratio, level, fade] of NIKKI_PARTIALS) {
      const f = freq * ratio;
      if (f > 12000) continue;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = f;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(vol * level, t + 0.004); // no click, still a clear strike
      gain.gain.setTargetAtTime(0, t + 0.004, fade / 3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      gain.connect(room);
      osc.start(t);
      osc.stop(t + fade * 3 + 0.05);
    }
  }
}
