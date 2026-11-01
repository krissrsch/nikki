// The sounds folder: a file named after an event replaces Nikki's own sound for it.
import fs from 'node:fs';
import path from 'node:path';

export const SOUND_EVENTS = {
  done: 'Claude ist fertig',
  needsYou: 'Claude braucht dich',
  hello: 'Nikkis Begrüßung',
  mrrp: 'Klick auf Nikki, kurz',
  chirp: 'Klick auf Nikki, fröhlich',
  mrow: 'Klick auf Nikki, lang',
  lift: 'Nikki springt ab',
  land: 'Nikki landet',
};
const MAX_BYTES = 5 * 1024 * 1024; // a chime, not an album: it is decoded whole into memory
const EXT = /\.(wav|mp3|ogg|flac|m4a)$/i;

// { done: 'done.mp3', ... }; only known names, the rest of the folder stays out of reach
export function soundFiles(dir) {
  const found = {};
  let names = [];
  try {
    names = fs.readdirSync(dir).sort();
  } catch {
    return found;
  }
  for (const file of names) {
    const name = file.replace(EXT, '');
    if (name === file || !Object.hasOwn(SOUND_EVENTS, name) || found[name]) continue;
    try {
      const s = fs.statSync(path.join(dir, file));
      if (s.isFile() && s.size <= MAX_BYTES) found[name] = file;
    } catch {}
  }
  return found;
}

export const soundsReadme = () =>
  `Eigene Töne für Nikki\r\n\r\nLeg hier eine Datei (wav, mp3, ogg, flac oder m4a, bis 5 MB) ab, die wie das Ereignis heißt, zum Beispiel done.mp3.\r\nFehlt eine Datei, spielt Nikki ihren eigenen Ton.\r\n\r\n${Object.entries(SOUND_EVENTS)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\r\n')}\r\n`;
