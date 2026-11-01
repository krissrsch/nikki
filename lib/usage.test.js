import assert from 'node:assert/strict';
import { test } from 'node:test';
import { limitWarnings, toUsage } from './usage.js';

const limits = { five_hour: { utilization: 10.4, resets_at: '2026-11-01T12:30:00.5Z' }, seven_day: { utilization: 91, resets_at: '2026-11-01T12:00:00.5Z' } };

test('toUsage: both windows, rounded; nothing usable gives null', () => {
  assert.deepEqual(toUsage(limits), { session: { percent: 10, resets: limits.five_hour.resets_at }, week: { percent: 91, resets: limits.seven_day.resets_at } });
  assert.deepEqual(toUsage({ five_hour: null, seven_day: { utilization: 0 } }), { session: null, week: { percent: 0, resets: null } });
  assert.equal(toUsage(null), null);
  assert.equal(toUsage({ five_hour: { utilization: null } }), null);
});

test('limitWarnings: once per window, again in the next, not when the seconds of resets_at wobble', () => {
  const seen = new Set();
  assert.deepEqual(limitWarnings(toUsage(limits), seen), ['Wochenlimit bei 91 %.']);
  const wobble = { ...limits, seven_day: { utilization: 93, resets_at: '2026-11-01T12:00:00.9Z' } };
  assert.deepEqual(limitWarnings(toUsage(wobble), seen), []);
  const next = { ...limits, seven_day: { utilization: 92, resets_at: '2026-11-08T12:00:00.5Z' } };
  assert.deepEqual(limitWarnings(toUsage(next), seen), ['Wochenlimit bei 92 %.']);
  assert.deepEqual(limitWarnings(null, seen), []);
});

test('limitWarnings: a reset time that wobbles across a minute boundary is still the same window', () => {
  const seen = new Set();
  const at = (resets_at) => toUsage({ seven_day: { utilization: 95, resets_at } });
  assert.deepEqual(limitWarnings(at('2026-11-01T11:59:59.9Z'), seen), ['Wochenlimit bei 95 %.']);
  assert.deepEqual(limitWarnings(at('2026-11-01T12:00:00.1Z'), seen), []);
  assert.deepEqual(limitWarnings(at('2026-11-08T12:00:00.1Z'), seen), ['Wochenlimit bei 95 %.']);
});
