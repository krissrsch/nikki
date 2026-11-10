// README screenshots with demo data: `node e2e/screenshots.js [de]` writes docs/screenshots/*.png (English unless "de").
// Same isolation as the e2e runs (temp userData and HOME, no helper, no network, muted): nothing of the user's own shows up.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { launch, rm, root, tmpDir, until } from './nikki.js';
import { demo } from './demo-data.js';

const lang = process.argv[2] === 'de' ? 'de' : 'en';
const out = path.join(root, 'docs', 'screenshots');
fs.mkdirSync(out, { recursive: true });

// a small git project to work in, so the chat shows a name and a branch
const project = path.join(tmpDir('demo'), 'weather-app');
fs.mkdirSync(project);
execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: project });

const d = demo(lang);
const nikki = await launch({ state: { lang, projects: [project], modules: d.modules }, files: d.files });
const { app, page } = nikki;
const fromMain = (c, x) => app.evaluate(({ BrowserWindow }, [c, x]) => BrowserWindow.getAllWindows().find((w) => w.isAlwaysOnTop()).webContents.send(c, x), [c, x]);

// cuts the see-through rows below what a window draws (the island's box reaches lower)
const trim = (png) =>
  app.evaluate(({ nativeImage }, b64) => {
    const img = nativeImage.createFromBuffer(Buffer.from(b64, 'base64'));
    const { width, height } = img.getSize();
    const px = img.toBitmap();
    let last = 0;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (px[(y * width + x) * 4 + 3] > 24) (last = y), (x = width);
    return img.crop({ x: 0, y: 0, width, height: last + 1 }).toPNG().toString('base64');
  }, png.toString('base64'));
const save = (name, b64) => (fs.writeFileSync(path.join(out, `${name}.png`), Buffer.from(b64, 'base64')), console.log('wrote', `${name}.png`));
async function shot(name, sel = '#island', pad = 24) {
  await page.waitForTimeout(1500); // the island grows to its new page and the content fades in
  // the island's box can lag behind what it draws: take the whole window height, trim cuts what is empty below
  const b = await page.locator(sel).boundingBox();
  const height = await page.evaluate(() => innerHeight);
  save(name, await trim(await page.screenshot({ clip: { x: Math.max(0, b.x - pad), y: 0, width: b.width + 2 * pad, height }, omitBackground: true })));
}
async function tab(view, wait) {
  await page.click(`#tabs .tab[data-view="${view}"]`);
  if (wait) await page.waitForSelector(wait);
}

try {
  // weather from a stand-in for Open-Meteo, set through the settings like a user would
  await app.evaluate(({ net }, w) => {
    const json = (body) => new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
    net.fetch = async (url) => json(String(url).includes('geocoding') ? w.place : w.forecast);
  }, d.weather);
  const s = await nikki.settings('today');
  await s.fill('#setCity', 'Augsburg');
  await s.press('#setCity', 'Enter');
  await until(() => nikki.state().weather?.temp === 9, 'weather');
  await s.click('.sideBtn[data-page="general"]');
  await s.waitForTimeout(500);
  save('settings', (await s.screenshot()).toString('base64'));
  await s.close();

  await fromMain('usage', d.usage);
  await fromMain('volume', { level: 55, muted: false });
  await fromMain('media', d.song);
  await fromMain('lyrics', d.lyrics);
  await page.click('#notch');
  await tab('home', '#homeTiles .musicLyric');
  await shot('home');
  await tab('music', '.mod-music .musicLyric');
  await shot('music');
  await tab('calendar', '.mod-calendar');
  await shot('calendar');
  await tab('todo', '.mod-todo');
  await shot('todo');
  await tab('notes', '.mod-notes textarea');
  await shot('notes');
  await tab('timer', '.mod-timer');
  await page.click('.mod-timer .btn.primary'); // running: the ring counts down
  await shot('timer');
  await fromMain('toasts', d.toasts);
  await tab('notifications', '.mod-notifications .toastRow');
  await shot('notifications');

  // Claude: a task with its steps, a permission card, then the answer
  await nikki.fakeClaude();
  await nikki.openChat();
  await nikki.send(d.prompt);
  for (const text of d.steps) await nikki.status({ state: 'working', text });
  await nikki.permission({ id: 1, toolName: 'Bash', input: { command: 'npm test' } });
  await page.waitForSelector('#permission:not([hidden])');
  await shot('permission');
  await page.click('#permission button:has-text("' + (lang === 'en' ? 'Allow' : 'Erlauben') + '")');
  await nikki.status({ state: 'done', text: d.doneText, answer: d.answer });
  await page.waitForTimeout(600);
  await shot('chat');

  // the closed notch (docs/screenshots/notch.png) comes from the demo recording, e2e/demo.js
  if (nikki.errors.length) console.error(nikki.errors);
} finally {
  await nikki.close();
  rm(path.dirname(project));
}
