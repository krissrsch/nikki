// Writes <file>.sha256 next to the installer ("<hash> *<name>", the format `sha256sum -c` reads), so a download can be checked
// against what the release page lists: node scripts/sha256.mjs Nikki-Setup.exe
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const file = process.argv[2];
if (!file || !fs.existsSync(file)) {
  console.error('usage: node scripts/sha256.mjs <file>');
  process.exit(1);
}
const hash = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
fs.writeFileSync(`${file}.sha256`, `${hash} *${path.basename(file)}\n`);
console.log(`${hash}  ${file}`);
