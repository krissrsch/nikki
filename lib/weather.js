// Weather for the Home tile from Open-Meteo (no account, no key): the city from the settings is looked up once (geocoding),
// then current temperature and weather code, the next hours and today's high and low. main fetches; this only builds URLs and reads answers.

export const geocodeUrl = (city) => `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=de`;
export const forecastUrl = ({ lat, lon }) =>
  `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,is_day&hourly=temperature_2m&daily=temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=2`;

// WMO weather codes (Open-Meteo docs) → German text and one of Nikki's icons; night only changes clear skies
const CODES = [
  [[0], 'Sonnig', 'sun', 'Klar', 'moon'],
  [[1], 'Heiter', 'partly', 'Überwiegend klar', 'moon'],
  [[2], 'Teils bewölkt', 'partly', 'Teils bewölkt', 'cloud'],
  [[3], 'Bedeckt', 'cloud'],
  [[45, 48], 'Nebel', 'fog'],
  [[51], 'Leichter Niesel', 'drizzle'],
  [[53], 'Nieselregen', 'drizzle'],
  [[55], 'Starker Niesel', 'drizzle'],
  [[56, 57], 'Gefrierender Niesel', 'drizzle'],
  [[61], 'Leichter Regen', 'rain'],
  [[63], 'Regen', 'rain'],
  [[65], 'Starkregen', 'rain'],
  [[66, 67], 'Gefrierender Regen', 'rain'],
  [[71], 'Leichter Schneefall', 'snow'],
  [[73], 'Schneefall', 'snow'],
  [[75], 'Starker Schneefall', 'snow'],
  [[77], 'Schneegriesel', 'snow'],
  [[80], 'Leichte Schauer', 'rain'],
  [[81], 'Schauer', 'rain'],
  [[82], 'Starke Schauer', 'rain'],
  [[85, 86], 'Schneeschauer', 'snow'],
  [[95], 'Gewitter', 'storm'],
  [[96, 99], 'Gewitter mit Hagel', 'storm'],
];
// { text, icon } for a code; an unknown code still gets a cloud and no text
export function weatherLook(code, day = true) {
  const row = CODES.find(([codes]) => codes.includes(code));
  if (!row) return { text: '', icon: 'cloud' };
  const [, text, icon, nightText = text, nightIcon = icon] = row;
  return day ? { text, icon } : { text: nightText, icon: nightIcon };
}

// geocoding answer → { name, lat, lon }, or null when the city was not found
export function parsePlace(json) {
  const r = json?.results?.[0];
  return r && Number.isFinite(r.latitude) && Number.isFinite(r.longitude) ? { name: String(r.name || ''), lat: r.latitude, lon: r.longitude } : null;
}

const round = (n) => (Number.isFinite(n) ? Math.round(n) : null);
// forecast answer → { temp, text, icon, max, min, hours: [{ h: '10', temp }] } (four hours, two apart, from the next full hour); throws on nonsense.
// Times are the place's local time (timezone=auto) as text, so they compare as strings without any time zone maths.
export function parseForecast(json) {
  const c = json?.current;
  if (!Number.isFinite(c?.temperature_2m) || !Number.isFinite(c?.weather_code)) throw new Error('Open-Meteo: unerwartete Antwort');
  const times = Array.isArray(json.hourly?.time) ? json.hourly.time : [];
  const temps = Array.isArray(json.hourly?.temperature_2m) ? json.hourly.temperature_2m : [];
  const first = times.findIndex((t) => String(t) > String(c.time ?? ''));
  const hours = first < 0 ? [] : [0, 2, 4, 6].map((k) => first + k).filter((i) => i < times.length && Number.isFinite(temps[i])).map((i) => ({ h: String(Number(String(times[i]).slice(11, 13))), temp: Math.round(temps[i]) }));
  return { temp: Math.round(c.temperature_2m), ...weatherLook(c.weather_code, c.is_day !== 0), max: round(json.daily?.temperature_2m_max?.[0]), min: round(json.daily?.temperature_2m_min?.[0]), hours };
}
