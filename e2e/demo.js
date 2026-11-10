// The README's demo GIF: `node e2e/demo.js [de]` plays a short scene with demo data and writes docs/demo.gif.
// Frames come from Electron itself (capturePage, ~15 a second, with their real times); ffmpeg must be on PATH.
// Same isolation as the e2e runs: temp profile, no helper, no network, muted.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { launch, rm, root, tmpDir } from './nikki.js';
import { demo } from './demo-data.js';

const lang = process.argv[2] === 'de' ? 'de' : 'en';
const d = demo(lang);
const frames = tmpDir('frames');
const project = path.join(tmpDir('demo'), 'weather-app');
fs.mkdirSync(project);
execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: project });

const nikki = await launch({ state: { lang, projects: [project], modules: d.modules, catJump: true }, files: d.files });
const { app, page } = nikki;
const fromMain = (c, x) => app.evaluate(({ BrowserWindow }, [c, x]) => BrowserWindow.getAllWindows().find((w) => w.isAlwaysOnTop()).webContents.send(c, x), [c, x]);
const wait = (ms) => page.waitForTimeout(ms);

try {
  // a dark desktop behind the see-through window, only for the recording
  await page.evaluate(() => (document.documentElement.style.background = 'radial-gradient(120% 140% at 50% 0%, #2a2f3a, #14161b 70%)')); // CSP: no style tags, but the style property is fine
  await app.evaluate(({ net }, w) => {
    const json = (body) => new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
    net.fetch = async (url) => json(String(url).includes('geocoding') ? w.place : w.forecast);
  }, d.weather);
  const s = await nikki.settings('today');
  await s.fill('#setCity', 'Augsburg');
  await s.press('#setCity', 'Enter');
  await s.waitForTimeout(800);
  await s.close();
  await nikki.fakeClaude();
  await fromMain('usage', d.usage);
  await page.evaluate(() => setOpen(false));
  await wait(1200);

  // the recorder: the middle of the window, where the island lives
  // the open island is 720 wide around the notch's middle; measured closed, so only the middle counts
  const box = await page.locator('#island').boundingBox();
  const rect = { x: Math.round(box.x + box.width / 2 - 420), y: 0, width: 840, height: 430 };
  await app.evaluate(({ BrowserWindow }, rect) => {
    const w = BrowserWindow.getAllWindows().find((x) => x.isAlwaysOnTop());
    globalThis.rec = { on: true, list: [] };
    (async () => {
      for (let i = 0; globalThis.rec.on; i++) {
        const at = Date.now();
        const png = (await w.webContents.capturePage(rect)).toPNG();
        globalThis.rec.list.push({ i, at, png: png.toString('base64') });
        await new Promise((r) => setTimeout(r, Math.max(0, 66 - (Date.now() - at))));
      }
    })();
  }, rect);

  // 1 closed notch: music starts, the edge takes the cover's colour, the spectrum moves
  await wait(900);
  await fromMain('media', d.song);
  await fromMain('lyrics', d.lyrics);
  await app.evaluate(({ BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows().find((x) => x.isAlwaysOnTop());
    let t = 0;
    globalThis.spec = setInterval(() => {
      t += 0.033;
      w.webContents.send('spectrum', Array.from({ length: 12 }, (_, i) => Math.max(0, Math.min(1, 0.5 + 0.38 * Math.sin(t * 7 + i * 0.8) * Math.exp(-i / 10) + (Math.random() - 0.5) * 0.3))));
    }, 33);
  });
  await wait(2600);

  // this frame, twice the size, is also the README's picture of the closed notch
  const notchShot = await app.evaluate(() => globalThis.rec.list.length - 1);

  // 2 open: Home with the song, its lyric line, weather and the plan limits
  await page.click('#notch');
  await wait(2400);

  // 3 a Claude task: prompt, steps, a permission, the answer
  await page.click('#tabs .tab[data-view="chat"]');
  await wait(500);
  await page.type('#prompt', d.prompt, { delay: 28 });
  await page.press('#prompt', 'Enter');
  for (const text of d.steps) {
    await nikki.status({ state: 'working', text });
    await wait(700);
  }
  await nikki.permission({ id: 1, toolName: 'Bash', input: { command: 'npm test' } });
  await wait(1700);
  await page.click(`#permission button:has-text("${lang === 'en' ? 'Allow' : 'Erlauben'}")`);
  await nikki.status({ state: 'working', text: 'Nikki: npm test…' });
  await wait(900);
  await nikki.status({ state: 'done', text: d.doneText, answer: d.answer });
  await wait(2600);

  // 4 closed again: the green "done" flash, then the music edge
  await app.evaluate(() => clearInterval(globalThis.spec));
  await fromMain('spectrum', null);
  await page.evaluate(() => setOpen(false));
  await wait(2600);

  const shots = await app.evaluate(() => {
    globalThis.rec.on = false;
    return globalThis.rec.list;
  });
  const notchPng = await app.evaluate(({ nativeImage }, b64) => {
    const img = nativeImage.createFromBuffer(Buffer.from(b64, 'base64'));
    const { width } = img.getSize();
    return img.crop({ x: Math.round(width / 2 - 230), y: 0, width: 460, height: 120 }).resize({ width: 920, quality: 'best' }).toPNG().toString('base64');
  }, shots[notchShot].png);
  fs.writeFileSync(path.join(root, 'docs', 'screenshots', 'notch.png'), Buffer.from(notchPng, 'base64'));
  // each frame lasts until the next one was taken: ffmpeg's concat list with real durations
  const list = shots.map((f, i) => {
    const file = path.join(frames, `${String(i).padStart(4, '0')}.png`);
    fs.writeFileSync(file, Buffer.from(f.png, 'base64'));
    const dur = ((shots[i + 1]?.at ?? f.at + 66) - f.at) / 1000;
    return `file '${file.replace(/\\/g, '/')}'\nduration ${dur.toFixed(3)}`;
  });
  fs.writeFileSync(path.join(frames, 'list.txt'), `${list.join('\n')}\nfile '${path.join(frames, `${String(shots.length - 1).padStart(4, '0')}.png`).replace(/\\/g, '/')}'\n`);
  const gif = path.join(root, 'docs', 'demo.gif');
  fs.mkdirSync(path.dirname(gif), { recursive: true });
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(frames, 'list.txt'), '-vf', 'fps=15,scale=720:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=160:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle', '-loop', '0', gif]);
  console.log(`wrote docs/demo.gif (${shots.length} frames, ${(fs.statSync(gif).size / 1e6).toFixed(1)} MB)`);
  if (nikki.errors.length) console.error(nikki.errors);
} finally {
  await nikki.close();
  rm(frames);
  rm(path.dirname(project));
}
