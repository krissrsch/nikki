import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ctx = vm.createContext({});
vm.runInContext(readFileSync(new URL('./i18n.js', import.meta.url), 'utf8'), ctx);
const en = JSON.parse(readFileSync(new URL('../i18n/en.json', import.meta.url), 'utf8'));

test('i18n: no companion (tests, main) means German and the German locale', () => {
  assert.equal(vm.runInContext('NIKKI_LANG', ctx), 'de');
  assert.equal(vm.runInContext('LOCALE', ctx), 'de-DE');
});

test('i18n: exact keys, the spaces around stay, unknown text passes through', () => {
  const t = ctx.i18nTranslator({ Einstellungen: 'Settings', 'Kosten: $&': 'Cost: $&' });
  assert.equal(t('Einstellungen'), 'Settings');
  assert.equal(t('  Einstellungen\n'), '  Settings\n');
  assert.equal(t('Kosten: $&'), 'Cost: $&', 'no replacement patterns in the English text');
  assert.equal(t('Paper Lanterns'), 'Paper Lanterns');
  assert.equal(t(''), '');
});

test('i18n: patterns translate what they capture, the most specific one wins', () => {
  const t = ctx.i18nTranslator({
    '{0} Einträge': '{0} entries',
    '{0} · Klick kopiert': '{0} · click to copy',
    'Stand {0} Uhr': 'as of {0}',
    'Stand {0}': 'status {0}',
    '{0}': 'never used: a key without fixed text',
  });
  assert.equal(t('3 Einträge · Klick kopiert'), '3 entries · click to copy');
  assert.equal(t('Stand 14:05 Uhr'), 'as of 14:05');
  assert.equal(t('Stand gestern'), 'status gestern');
  assert.equal(t('nur Text'), 'nur Text');
  assert.equal(ctx.i18nTranslator({ '{0} %': 'never: no words in it' })('42 %'), '42 %', 'numbers and times are left alone');
});

test('i18n: en.json is flat text, and every placeholder of a pattern comes back in its English', () => {
  for (const [de, out] of Object.entries(en)) {
    assert.equal(typeof out, 'string', de);
    assert.ok(out.trim(), `empty English for "${de}"`);
    for (const slot of de.match(/\{\d\}/g) ?? []) assert.ok(out.includes(slot), `"${de}" → "${out}" loses ${slot}`);
  }
});
