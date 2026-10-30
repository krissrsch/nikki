// What the closed notch shows: the eyes' mood, narrow or wide, at most one info per side.
// Pure; classic script (globals) like markdown-text.js. Peek, appointment and music get their data in phase 3.
// Rank: needs you > short hint (peek, ~2 s) > agent > appointment within 15 min > music > idle.
const GLANCE_SOON_MS = 15 * 60 * 1000;

// status: needsYou | working | thinking | done | error | idle (own or observed session, whichever the island shows)
// peek: { icon, text, right?, until } · event: { title, at } · music: { title, cover?, playing }
function glance({ status = 'idle', text = '', project = '', peek = null, event = null, music = null, lastActivity = 0, hover = false, sleepMin = 5, now = Date.now() } = {}) {
  const where = project ? { text: project, tone: 'muted' } : null;
  const items = [];
  if (status === 'needsYou') items.push({ mood: 'need', left: { icon: 'dot', text: text || 'braucht dich', tone: 'warn' }, right: where });
  if (peek && now < peek.until) items.push({ mood: 'awake', left: { icon: peek.icon, text: peek.text }, right: peek.right ?? null });
  if (status === 'working' || status === 'thinking') items.push({ mood: 'work', left: { icon: 'spin', text: 'arbeitet', tone: 'accent' }, right: where });
  if (status === 'done') items.push({ mood: 'done', left: { icon: 'check', text: 'fertig', tone: 'accent' }, right: where });
  if (status === 'error') items.push({ mood: 'awake', left: { icon: 'dot', text: 'stolpert', tone: 'bad' }, right: where });
  const soon = event ? event.at - now : -1;
  if (soon >= 0 && soon < GLANCE_SOON_MS) {
    const min = Math.ceil(soon / 60000);
    items.push({ mood: 'awake', left: { icon: 'calendar', text: event.title }, right: { text: min ? `in ${min} min` : 'jetzt', tone: 'warn' } });
  }
  if (music?.playing) {
    const cover = music.cover ?? null;
    items.push({ mood: 'music', left: { icon: 'cover', cover, text: music.title }, right: { icon: 'viz' }, compact: { icon: 'music', cover } });
  }
  const [top, next] = items;
  if (!top) return { mood: !hover && now - lastActivity >= sleepMin * 60000 ? 'sleep' : 'awake', wide: false, left: null, right: null };
  // the next item takes the right side; when Nikki needs you, which project asks matters more
  const right = next && top.mood !== 'need' ? next.compact ?? next.left : top.right;
  return { mood: top.mood, wide: true, left: top.left, right };
}

// Chat tab dot: warn = Claude needs you, bad = an error not seen yet, accent = done or a new answer; null = no dot.
function chatDot({ needsYou = false, unseen = null, terminalDone = false } = {}) {
  if (needsYou) return 'warn';
  if (unseen === 'error') return 'bad';
  return unseen === 'done' || terminalDone ? 'accent' : null;
}
