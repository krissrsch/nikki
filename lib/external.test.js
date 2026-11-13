import { test } from 'node:test';
import assert from 'node:assert/strict';
import { externalUrl } from './external.js';

test('nur gewöhnliche http(s)-Links werden geöffnet', () => {
  assert.equal(externalUrl('https://github.com/krissrsch/nikki/releases'), 'https://github.com/krissrsch/nikki/releases');
  assert.equal(externalUrl('HTTP://Example.com'), 'http://example.com/');
  for (const bad of ['file:///C:/Windows/System32/calc.exe', 'javascript:alert(1)', 'ms-msdt:/id x', 'vscode://file/x', '\\\\host\\share\\a.exe',
    'https://github.com@evil.example/login', 'https://user:pw@example.com', 'https://a.example/\u0000', 'kein link', '', null, undefined, 42,
    'https://example.com/' + 'a'.repeat(2100)]) assert.equal(externalUrl(bad), null, String(bad));
});
