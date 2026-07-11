const { readFileSync, writeFileSync, mkdtempSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { execFileSync } = require('node:child_process');

const html = readFileSync('index.html', 'utf8');
const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)];
if (scripts.length === 0) {
  throw new Error('No inline scripts found in index.html');
}
const dir = mkdtempSync(join(tmpdir(), 'ipcalc-inline-'));
scripts.forEach((match, index) => {
  const path = join(dir, `index-inline-${index + 1}.js`);
  writeFileSync(path, match[1]);
  execFileSync(process.execPath, ['--check', path], { stdio: 'inherit' });
});
console.log(`Checked ${scripts.length} inline script(s) from index.html`);
