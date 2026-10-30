// What the closed notch shows: only Nikki's eyes (their mood) and the light edge around the notch (glow, canvas Glow).
// No infos beside the eyes any more. Pure; classic script (globals) like markdown-text.js.
// Rank: voice > needs you > agent (working, done, error) > music or system sound > idle.

// status: needsYou | working | thinking | done | error | idle (own or observed session, whichever the island shows)
// music: { playing } from the music module · sound: the spectrum hears something · voice: Nikki listens (not wired yet)
// doneAge: ms since the status became done; its flash fades out, then what ranks below shows again
// glow: need | voice | work | done | error | music | null (no light edge)
const DONE_MS = 4000;
function glance({ status = 'idle', music = null, sound = false, voice = false, lastActivity = 0, hover = false, sleepMin = 5, now = Date.now(), doneAge = 0 } = {}) {
  if (voice) return { mood: 'awake', glow: 'voice' };
  if (status === 'needsYou') return { mood: 'need', glow: 'need' };
  if (status === 'working' || status === 'thinking') return { mood: 'work', glow: 'work' };
  if (status === 'done' && doneAge < DONE_MS) return { mood: 'done', glow: 'done' };
  if (status === 'error') return { mood: 'awake', glow: 'error' };
  if (music?.playing || sound) return { mood: 'music', glow: 'music' };
  return { mood: !hover && now - lastActivity >= sleepMin * 60000 ? 'sleep' : 'awake', glow: null };
}

// Chat tab dot: warn = Claude needs you, bad = an error not seen yet, accent = done or a new answer; null = no dot.
function chatDot({ needsYou = false, unseen = null, terminalDone = false } = {}) {
  if (needsYou) return 'warn';
  if (unseen === 'error') return 'bad';
  return unseen === 'done' || terminalDone ? 'accent' : null;
}
