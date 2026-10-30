import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// classic renderer script: run it in a sandbox and take its globals
const src = readFileSync(new URL('./markdown-text.js', import.meta.url), 'utf8');
const { prepareMd, onlyProse, normalizeMarkdown } = vm.runInNewContext(`${src}\n({ prepareMd, onlyProse, normalizeMarkdown })`);

test('fenced code stays byte-for-byte', () => {
  const code = '```js\nconsole.log(fs.readFileSync("a.txt"))\nuser.profile.name. Next\nx ** 2 ** 3\n```';
  assert.equal(prepareMd(code), code);
  assert.equal(prepareMd('~~~\na.b.Cd\n~~~'), '~~~\na.b.Cd\n~~~');
});

test('indented code, inline code and URLs stay untouched', () => {
  assert.equal(prepareMd('    user.profile.Name'), '    user.profile.Name');
  assert.equal(prepareMd('Öffne `config.json` und `a. B`.'), 'Öffne `config.json` und `a. B`.');
  assert.equal(prepareMd('Doku: https://example.com/docs.Html hier'), 'Doku: https://example.com/docs.Html hier');
  assert.equal(prepareMd('[docs](https://example.com/a.Bc)'), '[docs](https://example.com/a.Bc)');
});

test('file names in prose survive', () => {
  assert.equal(prepareMd('Ich lege notiz.txt an. Dann prüfe ich console.log(9*9).'), 'Ich lege notiz.txt an.\n\nDann prüfe ich console.log(9*9).');
});

test('prose: glued sentences split, abbreviations and lists keep shape', () => {
  assert.equal(prepareMd('Das ist fertig.Jetzt kommt mehr.'), 'Das ist fertig.\n\nJetzt kommt mehr.');
  assert.equal(prepareMd('Frag Dr. Müller, z.B. Heute'), 'Frag Dr. Müller, z.B. Heute');
  assert.equal(prepareMd('- Erstes. Zweites'), '- Erstes. Zweites');
  assert.equal(prepareMd('| a. B | c |'), '| a. B | c |');
});

test('prose after a code block is still tidied', () => {
  assert.equal(prepareMd('```\na.Bc\n```\nfertig.Jetzt'), '```\na.Bc\n```\nfertig.\n\nJetzt');
});

test('broken bold is repaired outside code only', () => {
  assert.equal(normalizeMarkdown('**Wichtig **'), '**Wichtig**');
  assert.equal(prepareMd('**`a.txt` **'), '**`a.txt`**');
  assert.equal(onlyProse('`x ** 2 **`', normalizeMarkdown), '`x ** 2 **`');
});
