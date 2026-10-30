// Commands for helper/NikkiHelper.exe (one line on its stdin). The renderer asks; only these get through, with a checked value.
const PLAIN = new Set(['toggle', 'play', 'pause', 'next', 'prev', 'mute', 'unmute']);

// the stdin line, or null for anything else (a typo must never reach the helper as "volume 0")
export function mediaCommand(cmd, value) {
  if (PLAIN.has(cmd)) return cmd;
  if (cmd === 'volume' && typeof value === 'number' && Number.isFinite(value)) return `volume ${Math.round(Math.min(100, Math.max(0, value)))}`;
  return null;
}
