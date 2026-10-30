import { test } from 'node:test';
import assert from 'node:assert/strict';
import { forecastUrl, geocodeUrl, parseForecast, parsePlace, weatherLook } from './weather.js';

// trimmed real answers (Open-Meteo, Berlin)
const place = { results: [{ id: 2950159, name: 'Berlin', latitude: 52.52437, longitude: 13.41053, country: 'Deutschland' }], generationtime_ms: 0.6 };
const hourly = Array.from({ length: 48 }, (_, i) => `2026-10-${30 + Math.floor(i / 24)}T${String(i % 24).padStart(2, '0')}:00`);
const forecast = {
  timezone: 'Europe/Berlin',
  current: { time: '2026-10-30T09:15', interval: 900, temperature_2m: 14.6, weather_code: 0, is_day: 1 },
  hourly: { time: hourly, temperature_2m: hourly.map((_, i) => 8 + (i % 24) / 2) },
  daily: { time: ['2026-10-30', '2026-10-31'], temperature_2m_max: [16.7, 12.1], temperature_2m_min: [8.6, 5.2] },
};

test('URLs: city encoded, German names, current + hourly + daily in local time', () => {
  assert.equal(geocodeUrl('Frankfurt am Main'), 'https://geocoding-api.open-meteo.com/v1/search?name=Frankfurt%20am%20Main&count=1&language=de');
  const u = new URL(forecastUrl({ lat: 52.52, lon: 13.41 }));
  assert.equal(u.host, 'api.open-meteo.com');
  assert.equal(u.searchParams.get('current'), 'temperature_2m,weather_code,is_day');
  assert.equal(u.searchParams.get('hourly'), 'temperature_2m');
  assert.equal(u.searchParams.get('daily'), 'temperature_2m_max,temperature_2m_min');
  assert.equal(u.searchParams.get('timezone'), 'auto');
});

test('place: first hit, or null when nothing was found', () => {
  assert.deepEqual(parsePlace(place), { name: 'Berlin', lat: 52.52437, lon: 13.41053 });
  assert.equal(parsePlace({ generationtime_ms: 0.2 }), null);
  assert.equal(parsePlace({ results: [{ name: 'X' }] }), null);
  assert.equal(parsePlace(null), null);
});

test('forecast: rounded now, high and low, four hours two apart from the next full hour', () => {
  assert.deepEqual(parseForecast(forecast), {
    temp: 15,
    text: 'Sonnig',
    icon: 'sun',
    max: 17,
    min: 9,
    hours: [
      { h: '10', temp: 13 },
      { h: '12', temp: 14 },
      { h: '14', temp: 15 },
      { h: '16', temp: 16 },
    ],
  });
  // late in the evening the hours run into tomorrow; past the end of the list there are fewer
  const late = parseForecast({ ...forecast, current: { ...forecast.current, time: '2026-10-30T22:40', is_day: 0 } });
  assert.deepEqual(late.hours.map((x) => x.h), ['23', '1', '3', '5']);
  assert.equal(late.text, 'Klar');
  assert.equal(late.icon, 'moon');
  assert.deepEqual(parseForecast({ ...forecast, current: { ...forecast.current, time: '2026-10-31T19:05' } }).hours.map((x) => x.h), ['20', '22']);
  assert.deepEqual(parseForecast({ current: forecast.current }), { temp: 15, text: 'Sonnig', icon: 'sun', max: null, min: null, hours: [] });
});

test('forecast: an answer without temperature or code is an error, not a 0°', () => {
  assert.throws(() => parseForecast({}));
  assert.throws(() => parseForecast({ current: { temperature_2m: 3 } }));
  assert.throws(() => parseForecast({ error: true, reason: 'Invalid' }));
});

test('codes: German text and an icon, night only for clear skies, unknown codes stay quiet', () => {
  assert.deepEqual(weatherLook(3), { text: 'Bedeckt', icon: 'cloud' });
  assert.deepEqual(weatherLook(3, false), { text: 'Bedeckt', icon: 'cloud' });
  assert.deepEqual(weatherLook(2, false), { text: 'Teils bewölkt', icon: 'cloud' });
  assert.deepEqual(weatherLook(48), { text: 'Nebel', icon: 'fog' });
  assert.deepEqual(weatherLook(63), { text: 'Regen', icon: 'rain' });
  assert.deepEqual(weatherLook(75), { text: 'Starker Schneefall', icon: 'snow' });
  assert.deepEqual(weatherLook(99), { text: 'Gewitter mit Hagel', icon: 'storm' });
  assert.deepEqual(weatherLook(42), { text: '', icon: 'cloud' });
  // every icon the table names exists in the renderer (app.js WEATHER_ICON)
  const icons = new Set([0, 1, 2, 3, 45, 51, 61, 71, 95].flatMap((c) => [weatherLook(c).icon, weatherLook(c, false).icon]));
  assert.deepEqual([...icons].sort(), ['cloud', 'drizzle', 'fog', 'moon', 'partly', 'rain', 'snow', 'storm', 'sun']);
});
