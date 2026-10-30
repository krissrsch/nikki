// Writes renderer/cat.css from renderer/cat.js (cat.test.js checks the file is current). Run: node scripts/build-cat-css.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';

const src = readFileSync(new URL('../renderer/cat.js', import.meta.url), 'utf8');
const { catCss } = vm.runInNewContext(`${src}\n({ catCss })`);
writeFileSync(new URL('../renderer/cat.css', import.meta.url), catCss());
