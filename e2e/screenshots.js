// README screenshots with demo data: `node e2e/screenshots.js` writes docs/screenshots/*.png.
// Same isolation as the e2e runs (temp userData and HOME, no helper, no network): nothing of the user's own shows up.
import fs from 'node:fs';
import path from 'node:path';
import { launch, root, until } from './nikki.js';

const out = path.join(root, 'docs', 'screenshots');
fs.mkdirSync(out, { recursive: true });

// an abstract cover drawn here, so no real album art ends up in the repo
const cover = `data:image/svg+xml;base64,${Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff8a9b"/><stop offset="1" stop-color="#7b2d6b"/></linearGradient></defs><rect width="256" height="256" fill="url(#g)"/><circle cx="170" cy="96" r="54" fill="#ffd3a8" opacity="0.85"/><path d="M0 200 Q64 150 128 190 T256 170 V256 H0z" fill="#3b1240" opacity="0.7"/></svg>`,
).toString('base64')}`;
const song = { app: 'Spotify.exe', title: 'Paper Lanterns', artist: 'The Quiet Hours', status: 'playing', position: 63, duration: 214, updatedAt: Date.now(), cover, color: '#f5a3b0' };
const lyrics = { title: song.title, artist: song.artist, lines: [{ t: 0, text: '' }, { t: 58, text: 'we hung the lights along the river' }, { t: 70, text: 'and waited for the night to start' }] };

const nikki = await launch({
  state: {
    modules: ['music', 'calendar', 'shelf', 'todo', 'notes', 'timer', 'notifications'].map((id) => ({ id, on: true })),
    projects: [path.join(root)],
  },
});
const { app, page } = nikki;
const fromMain = (c, d) => app.evaluate(({ BrowserWindow }, [c, d]) => BrowserWindow.getAllWindows().find((w) => w.isAlwaysOnTop()).webContents.send(c, d), [c, d]);
const shot = async (name, sel = '#island', pad = 24) => {
  await page.waitForTimeout(900); // the island's height animates: measure once it settled
  const b = await page.locator(sel).boundingBox();
  const png = await page.screenshot({ clip: { x: Math.max(0, b.x - pad), y: Math.max(0, b.y - pad), width: b.width + 2 * pad, height: b.height + 2 * pad }, omitBackground: true });
  // the island's box reaches below what it draws: cut the see-through rows at the bottom
  const trimmed = await app.evaluate(({ nativeImage }, b64) => {
    const img = nativeImage.createFromBuffer(Buffer.from(b64, 'base64'));
    const { width, height } = img.getSize();
    const px = img.toBitmap();
    let last = 0;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (px[(y * width + x) * 4 + 3] > 24) (last = y), (x = width);
    return img.crop({ x: 0, y: 0, width, height: last + 1 }).toPNG().toString('base64');
  }, png.toString('base64'));
  fs.writeFileSync(path.join(out, `${name}.png`), Buffer.from(trimmed, 'base64'));
  console.log('wrote', `${name}.png`);
};

try {
  // weather from a stand-in for Open-Meteo, set through the settings like a user would
  await app.evaluate(({ net }) => {
    const json = (body) => new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
    const times = Array.from({ length: 24 }, (_, i) => `2026-11-10T${String(i).padStart(2, '0')}:00`);
    net.fetch = async (url) =>
      String(url).includes('geocoding')
        ? json({ results: [{ name: 'Augsburg', latitude: 48.37, longitude: 10.9 }] })
        : json({ current: { time: '2026-11-10T14:00', temperature_2m: 9.2, weather_code: 2, is_day: 1 }, hourly: { time: times, temperature_2m: times.map((_, i) => 4 + Math.round(6 * Math.sin((i - 8) / 5))) }, daily: { temperature_2m_max: [11], temperature_2m_min: [3] } });
  });
  const s = await nikki.settings('today');
  await s.fill('#setCity', 'Augsburg');
  await s.press('#setCity', 'Enter');
  await until(() => nikki.state().weather?.temp === 9, 'Wetter');
  await s.close();

  await fromMain('volume', { level: 55, muted: false });
  await fromMain('media', song);
  await fromMain('lyrics', lyrics);
  await page.click('#notch');
  await page.click('#tabs .tab[data-view="home"]');
  await page.waitForSelector('#homeTiles .musicLyric');
  await shot('home');

  await page.click('#tabs .tab[data-view="music"]');
  await page.waitForSelector('.mod-music .musicLyric');
  await shot('music');

  await fromMain('toasts', {
    access: true,
    items: [
      { id: 2, app: 'Outlook', title: 'Sprint Review', body: 'Morgen 10:00 im Raum Lech', at: Date.now() - 5 * 60000 },
      { id: 1, app: 'Teams', title: 'Build ist durch', body: 'Alle 149 Tests grün', at: Date.now() - 22 * 60000 },
    ],
  });
  await page.click('#tabs .tab[data-view="notifications"]');
  await page.waitForSelector('.mod-notifications .toastRow');
  await shot('notifications');

  // Claude asks before running a command: the card in the chat
  await nikki.fakeClaude();
  await nikki.openChat();
  await nikki.status({ state: 'working', text: 'Claude arbeitet', steps: [{ tool: 'Read', text: 'README.md' }, { tool: 'Grep', text: 'lyrics' }] });
  await nikki.permission({ id: 1, toolName: 'Bash', input: { command: 'npm test' } });
  await page.waitForSelector('#permission:not([hidden])');
  await shot('permission');

  if (nikki.errors.length) console.error(nikki.errors);
} finally {
  await nikki.close();
}
