// Synced lyrics from LRCLIB (lrclib.net, free, no account) for the music module; off until switched on in the settings.
// Pure parts; main does the fetch. Only title, artist, album and length leave the PC.

const API = 'https://lrclib.net/api';

// [get, search]: get needs all four and matches the length within ±2 s; search is the fallback when get finds nothing
export function lyricsUrls({ title, artist, album, duration }) {
  const q = (o) => new URLSearchParams(o).toString();
  const urls = [];
  if (album && duration > 0) urls.push(`${API}/get?${q({ track_name: title, artist_name: artist, album_name: album, duration: Math.round(duration) })}`);
  urls.push(`${API}/search?${q({ track_name: title, artist_name: artist })}`);
  return urls;
}

// LRCLIB answer (one record from get, a list from search) -> lines, [] for an instrumental, null when none is synced.
// With the song's length known, only a record within 3 s counts: a radio edit's timings would run off.
export function pickLyrics(answer, duration = 0) {
  const all = (Array.isArray(answer) ? answer : answer ? [answer] : []).filter((r) => !(duration > 0 && r?.duration > 0) || Math.abs(r.duration - duration) <= 3);
  const hit = all.find((r) => typeof r?.syncedLyrics === 'string' && r.syncedLyrics.trim());
  if (hit) return parseLrc(hit.syncedLyrics);
  return all.some((r) => r?.instrumental) ? [] : null;
}

// "[01:02.34]text" -> [{ t: 62.34, text }], by time. A line may carry several stamps; tags like [ar:Queen] are dropped.
export function parseLrc(text) {
  const lines = [];
  for (const raw of String(text ?? '').split(/\r?\n/)) {
    const stamps = [...raw.matchAll(/\[(\d{1,3}):(\d{1,2}(?:[.:]\d{1,3})?)\]/g)];
    if (!stamps.length) continue;
    const words = raw.slice(stamps.at(-1).index + stamps.at(-1)[0].length).trim();
    for (const [, m, s] of stamps) lines.push({ t: Number(m) * 60 + Number(s.replace(':', '.')), text: words });
  }
  return lines.sort((a, b) => a.t - b.t);
}
