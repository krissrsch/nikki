import { test } from 'node:test';
import assert from 'node:assert/strict';
import { friendlyError } from './errors.js';

test('known CLI and SDK errors read as short German sentences', () => {
  const cases = {
    'No conversation found with session ID: 1f2e3d': /kennt Claude nicht mehr/,
    'Claude AI usage limit reached|1761800000': /Limit/,
    "5-hour limit reached ∙ resets 3pm": /Limit/,
    'API Error: 429 {"type":"error","error":{"type":"rate_limit_error"}}': /Limit/,
    'Invalid API key · Please run /login': /nicht angemeldet/,
    'Not logged in · Please run /login': /nicht angemeldet/,
    'OAuth token has expired. Please obtain a new token or refresh your existing token.': /nicht angemeldet/,
    'API Error: 529 {"type":"error","error":{"type":"overloaded_error","message":"Overloaded"}}': /überlastet/,
    'API Error: Connection error.': /Internet/,
    'request to https://api.anthropic.com failed, reason: getaddrinfo ENOTFOUND api.anthropic.com': /Internet/,
    'Prompt is too long': /zu lang/,
    error_max_turns: /zu viele Schritte/,
    'spawn ENOENT': /findet Claude Code nicht/,
    'spawn EFTYPE': /nicht starten/,
    'Agent beendet ohne Ergebnis.': /ohne Ergebnis/,
    'Claude Code process exited with code 1': /verabschiedet/,
  };
  for (const [raw, want] of Object.entries(cases)) assert.match(friendlyError(raw), want, raw);
});

test('a specific cause wins over the generic "process exited" around it', () => {
  assert.match(friendlyError('Claude Code process exited with code 1: Not logged in · Please run /login'), /nicht angemeldet/);
});

test('unknown errors say so and point to the details; nothing at all is still a sentence', () => {
  assert.match(friendlyError('error_during_execution'), /unter Details/);
  assert.match(friendlyError('Something odd happened'), /unter Details/);
  assert.equal(friendlyError(''), 'Nikki ist gestolpert.');
  assert.equal(friendlyError(undefined), 'Nikki ist gestolpert.');
});
