import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// classic renderer scripts share one global scope: run them in one sandbox, in index.html order, and take the pure parts
const ctx = vm.createContext({});
for (const f of ['modules.js', 'modules/calendar.js', 'modules/todo.js', 'modules/notes.js', 'modules/timer.js']) {
  vm.runInContext(readFileSync(new URL(`./${f}`, import.meta.url), 'utf8'), ctx, { filename: f });
}
const g = vm.runInContext('({ NikkiModules, moduleList, calDayKey, calMonth, calOnDay, calUpcoming, calDue, todoShown, notesWhen, timerLeft, timerText })', ctx);
// objects from the sandbox have another Object.prototype: compare plain copies
const plain = (v) => JSON.parse(JSON.stringify(v));
const MIN = 60 * 1000;

test('registry: the four modules register with page and tile, and no globals collide', () => {
  assert.deepEqual([...g.NikkiModules.keys()], ['calendar', 'todo', 'notes', 'timer']);
  for (const m of g.NikkiModules.values()) {
    assert.equal(typeof m.page, 'function', m.id);
    assert.equal(typeof m.tile, 'function', m.id);
    assert.match(m.icon, /^<svg class="ti"/, m.id);
  }
});

test('moduleList: saved order, unknown ids dropped, new modules last and off', () => {
  const ids = ['calendar', 'todo', 'notes', 'timer'];
  assert.deepEqual(plain(g.moduleList([{ id: 'timer', on: true }, { id: 'gone', on: true }, { id: 'notes', on: false }], ids)), [
    { id: 'timer', on: true },
    { id: 'notes', on: false },
    { id: 'calendar', on: false },
    { id: 'todo', on: false },
  ]);
  assert.deepEqual(plain(g.moduleList(undefined, ['a'])), [{ id: 'a', on: false }]);
});

test('calendar: month grid starts on Monday', () => {
  const oct = plain(g.calMonth(2026, 9)); // 1 Oct 2026 is a Thursday
  assert.deepEqual(oct.slice(0, 4), [null, null, null, 1]);
  assert.equal(oct.length, 34);
  assert.equal(oct.at(-1), 31);
  const feb = plain(g.calMonth(2026, 1)); // 1 Feb 2026 is a Sunday
  assert.equal(feb.indexOf(1), 6);
  assert.equal(feb.at(-1), 28);
  assert.equal(g.calMonth(2028, 1).at(-1), 29, 'leap year');
  assert.equal(g.calDayKey(new Date(2026, 0, 5, 23, 59).getTime()), '2026-01-05');
});

test('calendar: a day, what comes next, which reminder is due', () => {
  const now = new Date(2026, 9, 30, 9, 18).getTime();
  const at = (h, m) => new Date(2026, 9, 30, h, m).getTime();
  const daily = { title: 'Daily', at: at(9, 30), dur: 15 };
  const review = { title: 'Review', at: at(14, 0), dur: 60 };
  const early = { title: 'Früh', at: at(8, 0), dur: 30 };
  const tomorrow = { title: 'Morgen', at: new Date(2026, 9, 31, 9, 0).getTime(), dur: 30 };
  const events = [review, tomorrow, daily, early];
  assert.deepEqual(plain(g.calOnDay(events, '2026-10-30')).map((e) => e.title), ['Früh', 'Daily', 'Review']);
  assert.deepEqual(plain(g.calUpcoming(events, now)).map((e) => e.title), ['Daily', 'Review', 'Morgen'], 'started ones are not next');
  assert.deepEqual(plain(g.calDue(events, now)).map((e) => e.title), ['Daily']);
  assert.deepEqual(plain(g.calDue([{ ...daily, reminded: true }], now)), [], 'only once');
  assert.equal(g.calDue([{ ...daily, at: now + 15 * MIN }], now).length, 1, '15 min before');
  assert.equal(g.calDue([{ ...daily, at: now + 15 * MIN + 1 }], now).length, 0);
  assert.equal(g.calDue([{ ...daily, at: now - 1 }], now).length, 0, 'already started');
});

test('to-do: open first, project filter', () => {
  const items = [
    { id: 1, text: 'a', done: true, scope: null },
    { id: 2, text: 'b', done: false, scope: 'C:\\p' },
    { id: 3, text: 'c', done: false, scope: null },
    { id: 4, text: 'd', done: true, scope: 'C:\\p' },
  ];
  assert.deepEqual(plain(g.todoShown(items, 'all', 'C:\\p')).map((t) => t.id), [2, 3, 1, 4]);
  assert.deepEqual(plain(g.todoShown(items, 'project', 'C:\\p')).map((t) => t.id), [2, 4]);
  assert.deepEqual(plain(g.todoShown(items, 'project', 'C:\\other')), []);
});

test('notes: when a sheet was written', () => {
  const now = new Date(2026, 9, 30, 15, 0).getTime();
  assert.equal(g.notesWhen(new Date(2026, 9, 30, 9, 12).getTime(), now), 'heute, 09:12');
  assert.equal(g.notesWhen(new Date(2026, 9, 29, 23, 59).getTime(), now), 'gestern');
  assert.equal(g.notesWhen(new Date(2026, 9, 26, 8, 0).getTime(), now), 'Montag');
  assert.equal(g.notesWhen(new Date(2026, 9, 12, 8, 0).getTime(), now), '12. Okt.');
  assert.equal(g.notesWhen(new Date(2025, 9, 12, 8, 0).getTime(), now), '12. Okt. 2025');
});

test('timer: time left running, paused and fresh; mm:ss rounds up', () => {
  const now = 1_800_000_000_000;
  assert.equal(g.timerLeft({ preset: 25, endsAt: null, left: null }, now), 25 * MIN);
  assert.equal(g.timerLeft({ preset: 25, endsAt: now + 90_000, left: null }, now), 90_000);
  assert.equal(g.timerLeft({ preset: 25, endsAt: now - 5, left: null }, now), 0, 'never below zero');
  assert.equal(g.timerLeft({ preset: 5, endsAt: null, left: 61_000 }, now), 61_000, 'paused keeps its rest');
  assert.equal(g.timerText(25 * MIN), '25:00');
  assert.equal(g.timerText(18 * MIN + 30_001), '18:31');
  assert.equal(g.timerText(1), '00:01');
  assert.equal(g.timerText(0), '00:00');
});
