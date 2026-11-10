// Demo data for the README screenshots and the demo GIF (e2e/screenshots.js, e2e/demo.js). Made up, in both languages.

// an abstract cover drawn here, so no real album art ends up in the repo
const cover = `data:image/svg+xml;base64,${Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff8a9b"/><stop offset="1" stop-color="#7b2d6b"/></linearGradient></defs><rect width="256" height="256" fill="url(#g)"/><circle cx="170" cy="96" r="54" fill="#ffd3a8" opacity="0.85"/><path d="M0 200 Q64 150 128 190 T256 170 V256 H0z" fill="#3b1240" opacity="0.7"/></svg>`,
).toString('base64')}`;

const at = (dayOffset, hour, min = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, min, 0, 0);
  return d.getTime();
};

export function demo(lang) {
  const en = lang === 'en';
  const now = Date.now();
  const times = Array.from({ length: 24 }, (_, i) => `2026-11-10T${String(i).padStart(2, '0')}:00`);
  return {
    modules: ['music', 'calendar', 'shelf', 'todo', 'notes', 'timer', 'notifications'].map((id) => ({ id, on: true })),
    files: {
      'modules/calendar.json': {
        events: [
          { id: 'e1', title: en ? 'Sprint review' : 'Sprint-Review', at: at(0, 15, 30), dur: 45 },
          { id: 'e2', title: en ? 'Basketball' : 'Basketball', at: at(0, 19), dur: 90 },
          { id: 'e3', title: en ? 'Dentist' : 'Zahnarzt', at: at(1, 9), dur: 30 },
        ],
      },
      'modules/todo.json': {
        items: [
          { id: 't1', text: en ? 'Record the demo GIF' : 'Demo-GIF aufnehmen', done: false, scope: null, at: now - 3e6 },
          { id: 't2', text: en ? 'Answer the recruiter' : 'Recruiterin antworten', done: false, scope: null, at: now - 2e6 },
          { id: 't3', text: en ? 'Water the plants' : 'Blumen gießen', done: false, scope: null, at: now - 1e6 },
          { id: 't4', text: en ? 'Release 1.4.0' : 'Release 1.4.0', done: true, scope: null, at: now - 4e6 },
        ],
      },
      'modules/notes.json': {
        sheets: [
          { id: 'n1', at: now - 20 * 60000, text: en ? 'Ideas for Nikki\n\n- quick actions for the smart home\n- lyrics in the closed notch?\n- a tiny weekly summary on Fridays' : 'Ideen für Nikki\n\n- Schnell-Aktionen fürs Smart Home\n- Songtexte in der zugeklappten Notch?\n- freitags eine kleine Wochenübersicht' },
          { id: 'n2', at: now - 2 * 864e5, text: en ? 'Groceries: oat milk, coffee, cat food' : 'Einkauf: Hafermilch, Kaffee, Katzenfutter' },
        ],
        idx: 0,
      },
    },
    weather: {
      place: { results: [{ name: 'Augsburg', latitude: 48.37, longitude: 10.9 }] },
      forecast: { current: { time: '2026-11-10T14:00', temperature_2m: 9.2, weather_code: 2, is_day: 1 }, hourly: { time: times, temperature_2m: times.map((_, i) => 4 + Math.round(6 * Math.sin((i - 8) / 5))) }, daily: { temperature_2m_max: [11], temperature_2m_min: [3] } },
    },
    usage: { session: { percent: 38, resets: new Date(now + 2.4 * 36e5).toISOString() }, week: { percent: 61, resets: new Date(now + 3 * 864e5).toISOString() } },
    song: { app: 'Spotify.exe', title: 'Paper Lanterns', artist: 'The Quiet Hours', album: 'Night Market', status: 'playing', position: 63, duration: 214, updatedAt: now, cover, color: '#f5a3b0' },
    lyrics: { title: 'Paper Lanterns', artist: 'The Quiet Hours', lines: [{ t: 0, text: '' }, { t: 58, text: 'we hung the lights along the river' }, { t: 70, text: 'and waited for the night to start' }] },
    toasts: {
      access: true,
      items: [
        { id: 2, app: 'Outlook', title: en ? 'Sprint review' : 'Sprint-Review', body: en ? 'Today 15:30, room Lech' : 'Heute 15:30, Raum Lech', at: now - 5 * 60000 },
        { id: 1, app: 'GitHub', title: en ? 'All checks have passed' : 'Alle Checks bestanden', body: 'krissrsch/nikki · test', at: now - 22 * 60000 },
      ],
    },
    prompt: en ? 'Add a 7-day forecast to the weather page and run the tests' : 'Füge der Wetterseite eine 7-Tage-Vorhersage hinzu und lass die Tests laufen',
    // the status texts the Claude backend sends, in German like lib/status.js; the island translates them
    steps: ['Nikki liest weather.js…', 'Nikki sucht…', 'Nikki tippt forecast.js…'],
    doneText: 'Nikki ist fertig.',
    answer: en
      ? 'Added a **7-day forecast** below today\'s weather:\n\n- `forecast.js` fetches the daily min/max from Open-Meteo\n- the page shows one row per day with an icon\n- `npm test`: 41 passed'
      : 'Unter dem heutigen Wetter steht jetzt eine **7-Tage-Vorhersage**:\n\n- `forecast.js` holt Min/Max pro Tag von Open-Meteo\n- die Seite zeigt eine Zeile pro Tag mit Symbol\n- `npm test`: 41 bestanden',
  };
}
