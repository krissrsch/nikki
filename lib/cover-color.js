// The cover's colour for the glow and the music tile: the hue most of its lively pixels share, lifted so it reads as light on black.
// px: BGRA bytes as nativeImage.toBitmap() gives them. '' when the cover is grey, black or white, and the glow keeps its blue.

const LIVELY = 0.25; // saturation below this counts as grey
const MIN_SHARE = 0.05; // fewer lively pixels than this: the cover has no colour of its own

export function coverColor(px, step = 4) {
  const bins = Array.from({ length: 12 }, () => ({ w: 0, r: 0, g: 0, b: 0 })); // 30° of hue each
  let seen = 0;
  let lively = 0;
  for (let i = 0; i + 3 < px.length; i += 4 * step) {
    const b = px[i];
    const g = px[i + 1];
    const r = px[i + 2];
    seen++;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const sat = max ? (max - min) / max : 0;
    if (sat < LIVELY || max < 40) continue;
    lively++;
    const bin = bins[Math.floor(hue(r, g, b, max, min) / 30) % 12];
    const w = sat * (max / 255); // bright, strong colours count more than dull ones
    bin.w += w;
    bin.r += r * w;
    bin.g += g * w;
    bin.b += b * w;
  }
  if (!seen || lively / seen < MIN_SHARE) return '';
  const top = bins.reduce((a, c) => (c.w > a.w ? c : a));
  const [h, s] = toHsl(top.r / top.w, top.g / top.w, top.b / top.w);
  return hex(...fromHsl(h, Math.min(1, Math.max(0.55, s)), 0.8));
}

function hue(r, g, b, max, min) {
  const d = max - min;
  if (!d) return 0;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

function toHsl(r, g, b) {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  const l = (max + min) / 2;
  const d = max - min;
  const s = d ? d / (1 - Math.abs(2 * l - 1)) : 0;
  return [hue(r, g, b, Math.max(r, g, b), Math.min(r, g, b)), s, l];
}

function fromHsl(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [r + m, g + m, b + m].map((v) => Math.round(v * 255));
}

const hex = (...rgb) => `#${rgb.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
