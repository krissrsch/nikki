import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

// The spectrum analysis lives in C# (NikkiHelper.cs, class Spectrum) and checks itself; skipped until helper\build.cmd ran.
const exe = fileURLToPath(new URL('./NikkiHelper.exe', import.meta.url));

test('spectrum: a 1 kHz tone fills its own band, silence stays quiet', { skip: !fs.existsSync(exe) && 'NikkiHelper.exe not built' }, () => {
  const out = execFileSync(exe, ['--spectrum-test'], { encoding: 'utf8', timeout: 10000 }); // throws on exit code 1
  const [bands, result] = out.trim().split(/\r?\n/).map((l) => JSON.parse(l));
  assert.deepEqual(result, { type: 'selftest', ok: true, top: 6 });
  assert.equal(bands.type, 'spectrum');
  assert.equal(bands.bands.length, 12);
  assert.ok(bands.bands.every((v, i) => (i === 6 ? v > 0.6 : v < 0.2)), JSON.stringify(bands.bands));
});
